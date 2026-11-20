"""ClimatePlus backend.

A thin, read-only bridge between the ClimatePlus dashboard (served through
Home Assistant ingress) and the Home Assistant Core WebSocket API.

Responsibilities:
  * keep one authenticated WebSocket connection to Home Assistant
  * cache states + area/floor/device/entity registries for climate entities
  * expose a small JSON API for the dashboard (bootstrap, series, forecast)
  * forward live state changes to connected dashboards
  * store the app's own settings (hidden entities) in /data/settings.json
All comfort/insight logic lives in the frontend. Home Assistant itself is only
read, never changed.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import os
import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable

import aiohttp
from aiohttp import WSMsgType, web

VERSION = os.environ.get("CLIMATEPLUS_VERSION", "dev")
SUPERVISOR_TOKEN = os.environ.get("SUPERVISOR_TOKEN", "")
# HA_URL/HA_TOKEN allow local development against a Home Assistant instance
# with a long-lived access token. Inside the app the Supervisor proxy is used.
HA_WS_URL = os.environ.get("HA_WS_URL", "ws://supervisor/core/websocket")
HA_TOKEN = os.environ.get("HA_TOKEN") or SUPERVISOR_TOKEN
OPTIONS_PATH = Path(os.environ.get("CLIMATEPLUS_OPTIONS", "/data/options.json"))
SETTINGS_PATH = Path(os.environ.get("CLIMATEPLUS_SETTINGS", "/data/settings.json"))
ENTITY_ID_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")
MAX_EXCLUDED = 2000
STATIC_DIR = Path(__file__).parent / "static"
PORT = int(os.environ.get("CLIMATEPLUS_PORT", "8099"))
INGRESS_IP = "172.30.32.2"

DEFAULT_OPTIONS: dict[str, Any] = {
    "language": "auto",
    "temperature_comfort_min": 19.5,
    "temperature_comfort_max": 22.5,
    "humidity_comfort_min": 40,
    "humidity_comfort_max": 60,
    "co2_warning": 1000,
    "co2_critical": 1400,
    "stale_sensor_hours": 6,
    "low_battery_percent": 20,
    "weather_entity": "",
    "outdoor_temperature_entity": "",
    "outdoor_humidity_entity": "",
    "exclude_entities": [],
    "demo_mode": False,
    "log_level": "info",
}

SENSOR_CLASSES = {
    "temperature",
    "humidity",
    "illuminance",
    "carbon_dioxide",
    "carbon_monoxide",
    "pm1",
    "pm25",
    "pm10",
    "volatile_organic_compounds",
    "volatile_organic_compounds_parts",
    "nitrogen_dioxide",
    "ozone",
    "aqi",
    "atmospheric_pressure",
    "pressure",
    "sound_pressure",
    "battery",
}
SENSOR_UNITS = {"°C", "°F", "lx", "ppm", "ppb", "µg/m³", "μg/m³", "hPa", "mbar"}
BINARY_CLASSES = {"window", "door", "opening", "garage_door"}
ALWAYS_DOMAINS = {"climate", "weather", "fan", "humidifier", "light"}
UNAVAILABLE = {"unavailable", "unknown", "none", ""}
REGISTRY_EVENTS = (
    "area_registry_updated",
    "device_registry_updated",
    "entity_registry_updated",
    "floor_registry_updated",
)
ACTIVE_ACTIONS = {"heating", "preheating", "cooling", "drying"}

_LOGGER = logging.getLogger("climateplus")


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def load_options() -> dict[str, Any]:
    options = dict(DEFAULT_OPTIONS)
    try:
        options.update(json.loads(OPTIONS_PATH.read_text("utf-8")))
    except FileNotFoundError:
        _LOGGER.info("No options file at %s, using defaults", OPTIONS_PATH)
    except (OSError, ValueError) as err:
        _LOGGER.warning("Could not read options (%s), using defaults", err)
    options["exclude_entities"] = [e for e in options.get("exclude_entities") or [] if e]
    return options


def clean_entity_ids(value: Any) -> list[str]:
    """Validate a list of entity IDs from the dashboard; raises ValueError."""
    if not isinstance(value, list):
        raise ValueError("exclude_entities must be a list")
    if len(value) > MAX_EXCLUDED:
        raise ValueError("too many entities")
    cleaned: list[str] = []
    for item in value:
        if not isinstance(item, str) or not ENTITY_ID_RE.match(item):
            raise ValueError(f"invalid entity id: {str(item)[:80]}")
        if item not in cleaned:
            cleaned.append(item)
    return sorted(cleaned)


def load_settings() -> dict[str, Any]:
    """Settings changed from the dashboard (stored next to options.json)."""
    try:
        data = json.loads(SETTINGS_PATH.read_text("utf-8"))
        return {"exclude_entities": clean_entity_ids(data.get("exclude_entities", []))}
    except FileNotFoundError:
        pass
    except (OSError, ValueError, AttributeError) as err:
        _LOGGER.warning("Ignoring unreadable settings file %s (%s)", SETTINGS_PATH, err)
    return {"exclude_entities": []}


def save_settings(settings: dict[str, Any]) -> None:
    """Write settings atomically so a crash never leaves a half-written file."""
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = SETTINGS_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(settings, indent=2), "utf-8")
    os.replace(tmp, SETTINGS_PATH)


def is_battery(state: dict) -> bool:
    attrs = state.get("attributes") or {}
    return state.get("entity_id", "").startswith("sensor.") and attrs.get("device_class") == "battery"


def is_relevant(state: dict, excluded: set[str]) -> bool:
    entity_id = state.get("entity_id", "")
    if not entity_id or entity_id in excluded:
        return False
    domain = entity_id.split(".", 1)[0]
    attrs = state.get("attributes") or {}
    if domain in ALWAYS_DOMAINS or entity_id == "sun.sun":
        return True
    if domain == "sensor":
        return attrs.get("device_class") in SENSOR_CLASSES or attrs.get("unit_of_measurement") in SENSOR_UNITS
    if domain == "binary_sensor":
        return attrs.get("device_class") in BINARY_CLASSES
    return False


def to_float(value: Any) -> float | None:
    if value is None or (isinstance(value, str) and value.lower() in UNAVAILABLE):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def iso(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).isoformat()


def parse_time(value: str | None, default: datetime) -> datetime:
    if not value:
        return default
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as err:
        raise web.HTTPBadRequest(text=f"invalid time: {value}") from err
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def ts_ms(value: Any) -> float | None:
    """Convert HA timestamps (epoch seconds, epoch ms or ISO string) to epoch ms."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value) * 1000.0 if value < 1e11 else float(value)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp() * 1000.0
    except ValueError:
        return None


def bucketize(points: list[tuple[float, float | None]], start: float, end: float, count: int) -> dict:
    """Time-weighted resampling of a step function into `count` equal buckets."""
    out: dict[str, list] = {"t": [], "v": [], "mn": [], "mx": []}
    if count <= 0 or end <= start:
        return out
    width = (end - start) / count
    idx = 0
    current: float | None = None
    while idx < len(points) and points[idx][0] <= start:
        current = points[idx][1]
        idx += 1
    for bucket in range(count):
        b_start = start + bucket * width
        b_end = b_start + width
        acc = 0.0
        duration = 0.0
        low = high = current
        cursor = b_start
        while idx < len(points) and points[idx][0] < b_end:
            p_time, p_value = points[idx]
            if current is not None:
                acc += current * (p_time - cursor)
                duration += p_time - cursor
            current = p_value
            cursor = p_time
            if current is not None:
                low = current if low is None else min(low, current)
                high = current if high is None else max(high, current)
            idx += 1
        if current is not None:
            acc += current * (b_end - cursor)
            duration += b_end - cursor
        value = acc / duration if duration > 0 else None
        out["t"].append(round(b_start + width / 2))
        out["v"].append(None if value is None else round(value, 2))
        out["mn"].append(None if low is None else round(low, 2))
        out["mx"].append(None if high is None else round(high, 2))
    return out


def segments(points: list[tuple[float, Any]], active: Callable[[Any], bool], start: float, end: float) -> list:
    result: list[list] = []
    seg_start: float | None = None
    seg_value: Any = None
    for p_time, value in points:
        on = active(value)
        if on and seg_start is None:
            seg_start, seg_value = max(p_time, start), value
        elif not on and seg_start is not None:
            if p_time > start:
                result.append([round(seg_start), round(p_time), seg_value])
            seg_start = None
    if seg_start is not None:
        result.append([round(seg_start), round(end), seg_value])
    return result


# --------------------------------------------------------------------------
# Home Assistant WebSocket client
# --------------------------------------------------------------------------
class HAError(Exception):
    """Error returned by Home Assistant."""


class HomeAssistant:
    def __init__(
        self, options: dict[str, Any], settings: dict[str, Any], broadcast: Callable[[dict], Awaitable[None]]
    ):
        self.options = options
        self.broadcast = broadcast
        self.option_excluded = set(options["exclude_entities"])
        self.app_excluded = set(settings.get("exclude_entities") or [])
        self.connected = asyncio.Event()
        self.config: dict[str, Any] = {}
        self.states: dict[str, dict] = {}
        self.areas: list[dict] = []
        self.floors: list[dict] = []
        self.devices: dict[str, dict] = {}
        self.entity_registry: dict[str, dict] = {}
        self.relevant: set[str] = set()
        self._ws: aiohttp.ClientWebSocketResponse | None = None
        self._msg_id = 0
        self._pending: dict[int, asyncio.Future] = {}
        self._handlers: dict[int, Callable[[dict], None]] = {}
        self._reload_task: asyncio.Task | None = None
        self._tasks: set[asyncio.Task] = set()
        self._forecast_cache: dict[str, tuple[float, Any]] = {}

    # -- connection -------------------------------------------------------
    async def run(self, session: aiohttp.ClientSession) -> None:
        delay = 2
        while True:
            try:
                await self._connect(session)
                delay = 2
            except asyncio.CancelledError:
                raise
            except Exception as err:  # noqa: BLE001 - keep reconnecting whatever happens
                _LOGGER.warning("Home Assistant connection lost: %s", err)
            finally:
                self._teardown()
            await self.broadcast({"type": "status", "connected": False})
            await asyncio.sleep(delay)
            delay = min(delay * 2, 60)

    async def _connect(self, session: aiohttp.ClientSession) -> None:
        _LOGGER.info("Connecting to Home Assistant at %s", HA_WS_URL)
        async with session.ws_connect(HA_WS_URL, heartbeat=30, max_msg_size=0) as ws:
            hello = await ws.receive_json(timeout=30)
            if hello.get("type") != "auth_required":
                raise HAError(f"unexpected handshake: {hello}")
            await ws.send_json({"type": "auth", "access_token": HA_TOKEN})
            auth = await ws.receive_json(timeout=30)
            if auth.get("type") != "auth_ok":
                raise HAError(f"authentication failed: {auth.get('message', auth.get('type'))}")
            _LOGGER.info("Connected to Home Assistant %s", auth.get("ha_version", "?"))
            self._ws = ws
            reader = asyncio.create_task(self._reader(ws))
            try:
                await self._initialise()
                self.connected.set()
                await self.broadcast({"type": "status", "connected": True})
                await self.broadcast({"type": "reload"})
                await reader
            finally:
                reader.cancel()

    def _teardown(self) -> None:
        self.connected.clear()
        self._ws = None
        self._handlers.clear()
        for future in self._pending.values():
            if not future.done():
                future.set_exception(HAError("connection closed"))
        self._pending.clear()

    async def _reader(self, ws: aiohttp.ClientWebSocketResponse) -> None:
        async for msg in ws:
            if msg.type != WSMsgType.TEXT:
                if msg.type in (WSMsgType.CLOSED, WSMsgType.ERROR):
                    break
                continue
            payload = json.loads(msg.data)
            for item in payload if isinstance(payload, list) else [payload]:
                self._dispatch(item)
        raise HAError("websocket closed")

    def _dispatch(self, item: dict) -> None:
        msg_type = item.get("type")
        msg_id = item.get("id")
        if msg_type == "result":
            future = self._pending.pop(msg_id, None)
            if future and not future.done():
                if item.get("success"):
                    future.set_result(item.get("result"))
                else:
                    error = item.get("error") or {}
                    future.set_exception(HAError(f"{error.get('code')}: {error.get('message')}"))
        elif msg_type == "event":
            handler = self._handlers.get(msg_id)
            if handler:
                try:
                    handler(item.get("event") or {})
                except Exception:  # noqa: BLE001
                    _LOGGER.exception("Error handling event")

    async def call(self, message: dict, timeout: float = 60) -> Any:
        if self._ws is None or self._ws.closed:
            raise HAError("not connected to Home Assistant")
        self._msg_id += 1
        msg_id = self._msg_id
        future: asyncio.Future = asyncio.get_running_loop().create_future()
        self._pending[msg_id] = future
        await self._ws.send_json({**message, "id": msg_id})
        try:
            return await asyncio.wait_for(future, timeout)
        finally:
            self._pending.pop(msg_id, None)

    async def subscribe(self, event_type: str, handler: Callable[[dict], None]) -> None:
        if self._ws is None:
            raise HAError("not connected to Home Assistant")
        self._msg_id += 1
        msg_id = self._msg_id
        self._handlers[msg_id] = handler
        future: asyncio.Future = asyncio.get_running_loop().create_future()
        self._pending[msg_id] = future
        await self._ws.send_json({"id": msg_id, "type": "subscribe_events", "event_type": event_type})
        await asyncio.wait_for(future, 30)

    # -- data -------------------------------------------------------------
    async def _initialise(self) -> None:
        self.config = await self.call({"type": "get_config"}) or {}
        await self._load_registries()
        states = await self.call({"type": "get_states"}) or []
        self.states = {s["entity_id"]: s for s in states}
        self._rebuild_relevant()
        await self.subscribe("state_changed", self._on_state_changed)
        for event_type in REGISTRY_EVENTS:
            await self.subscribe(event_type, self._on_registry_changed)
        _LOGGER.info("Tracking %d climate related entities", len(self.relevant))

    async def _load_registries(self) -> None:
        self.areas = await self.call({"type": "config/area_registry/list"}) or []
        try:
            self.floors = await self.call({"type": "config/floor_registry/list"}) or []
        except HAError:
            self.floors = []  # Home Assistant < 2024.4
        devices = await self.call({"type": "config/device_registry/list"}) or []
        self.devices = {d["id"]: d for d in devices}
        entities = await self.call({"type": "config/entity_registry/list"}) or []
        self.entity_registry = {e["entity_id"]: e for e in entities}

    @property
    def excluded(self) -> set[str]:
        return self.option_excluded | self.app_excluded

    async def set_app_excluded(self, entity_ids: list[str]) -> None:
        self.app_excluded = set(entity_ids)
        self._rebuild_relevant()
        await self.broadcast({"type": "reload"})

    def _rebuild_relevant(self) -> None:
        self.relevant = self._climate_entities(self.excluded)

    def _climate_entities(self, excluded: set[str]) -> set[str]:
        relevant: set[str] = set()
        for entity_id, state in self.states.items():
            if not is_relevant(state, excluded):
                continue
            entry = self.entity_registry.get(entity_id) or {}
            if entry.get("disabled_by"):
                continue
            # Skip diagnostic/config entities (CPU temperatures etc.), except batteries
            if entry.get("entity_category") and not is_battery(state):
                continue
            relevant.add(entity_id)
        climate_devices = {
            self.entity_registry[e].get("device_id")
            for e in relevant
            if e in self.entity_registry and not is_battery(self.states[e])
        }
        climate_devices.discard(None)
        for entity_id in list(relevant):
            if is_battery(self.states[entity_id]):
                device_id = (self.entity_registry.get(entity_id) or {}).get("device_id")
                if device_id not in climate_devices:
                    relevant.discard(entity_id)
        return relevant

    def entity_catalog(self) -> dict[str, Any]:
        """All climate entities ClimatePlus can show, including hidden ones (for the settings page)."""
        items = []
        for entity_id in sorted(self._climate_entities(set()) - {"sun.sun"}):
            state = self.states.get(entity_id) or {}
            attrs = state.get("attributes") or {}
            entry = self.entity_registry.get(entity_id) or {}
            device = self.devices.get(entry.get("device_id") or "") or {}
            if entity_id in self.option_excluded:
                excluded_by = "options"
            elif entity_id in self.app_excluded:
                excluded_by = "app"
            else:
                excluded_by = None
            items.append(
                {
                    "entity_id": entity_id,
                    "state": state.get("state"),
                    "attributes": {
                        k: attrs.get(k)
                        for k in ("friendly_name", "device_class", "unit_of_measurement", "current_temperature")
                        if attrs.get(k) is not None
                    },
                    "area_id": entry.get("area_id") or device.get("area_id"),
                    "device": device.get("name_by_user") or device.get("name"),
                    "platform": entry.get("platform"),
                    "excluded_by": excluded_by,
                }
            )
        areas = [{"area_id": a.get("area_id"), "name": a.get("name")} for a in self.areas]
        return {"entities": items, "areas": areas}

    def _on_state_changed(self, event: dict) -> None:
        data = event.get("data") or {}
        entity_id = data.get("entity_id")
        new_state = data.get("new_state")
        if not entity_id:
            return
        if new_state is None:
            self.states.pop(entity_id, None)
        else:
            self.states[entity_id] = new_state
        if entity_id in self.relevant:
            if new_state is None:
                self._schedule_reload()
            else:
                task = asyncio.create_task(
                    self.broadcast({"type": "state", "entity_id": entity_id, "state": new_state})
                )
                self._tasks.add(task)
                task.add_done_callback(self._tasks.discard)
        elif new_state is not None and is_relevant(new_state, self.excluded) and not is_battery(new_state):
            self._schedule_reload()

    def _on_registry_changed(self, _event: dict) -> None:
        self._schedule_reload(refresh_registries=True)

    def _schedule_reload(self, refresh_registries: bool = False) -> None:
        if self._reload_task and not self._reload_task.done():
            return

        async def _reload() -> None:
            await asyncio.sleep(3)
            try:
                if refresh_registries:
                    await self._load_registries()
                self._rebuild_relevant()
                await self.broadcast({"type": "reload"})
            except HAError as err:
                _LOGGER.debug("Reload skipped: %s", err)

        self._reload_task = asyncio.create_task(_reload())

    def bootstrap(self) -> dict[str, Any]:
        states = [self.states[e] for e in sorted(self.relevant) if e in self.states]
        entities: dict[str, dict] = {}
        device_ids: set[str] = set()
        for entity_id in self.relevant:
            entry = self.entity_registry.get(entity_id)
            if not entry:
                continue
            entities[entity_id] = {
                "area_id": entry.get("area_id"),
                "device_id": entry.get("device_id"),
                "name": entry.get("name") or entry.get("original_name"),
                "platform": entry.get("platform"),
            }
            if entry.get("device_id"):
                device_ids.add(entry["device_id"])
        devices = {
            device_id: {
                "area_id": d.get("area_id"),
                "name": d.get("name_by_user") or d.get("name"),
                "manufacturer": d.get("manufacturer"),
                "model": d.get("model"),
                "entry_type": d.get("entry_type"),
            }
            for device_id, d in self.devices.items()
            if device_id in device_ids
        }
        areas = [
            {
                "area_id": a.get("area_id"),
                "name": a.get("name"),
                "floor_id": a.get("floor_id"),
                "icon": a.get("icon"),
                "temperature_entity_id": a.get("temperature_entity_id"),
                "humidity_entity_id": a.get("humidity_entity_id"),
            }
            for a in self.areas
        ]
        floors = [
            {"floor_id": f.get("floor_id"), "name": f.get("name"), "level": f.get("level"), "icon": f.get("icon")}
            for f in self.floors
        ]
        cfg = self.config
        return {
            "demo": False,
            "connected": self.connected.is_set(),
            "config": {
                "location_name": cfg.get("location_name"),
                "language": cfg.get("language"),
                "time_zone": cfg.get("time_zone"),
                "unit_system": cfg.get("unit_system") or {},
                "version": cfg.get("version"),
                "latitude": cfg.get("latitude"),
                "longitude": cfg.get("longitude"),
            },
            "areas": areas,
            "floors": floors,
            "devices": devices,
            "entities": entities,
            "states": states,
        }

    async def series(self, ids: list[str], start: datetime, end: datetime, points: int) -> dict[str, Any]:
        result: dict[str, Any] = {}
        span = end - start
        history_ids = list(ids)
        history_start = start
        if span > timedelta(days=7):
            period = "hour" if span <= timedelta(days=35) else "day"
            candidates = [i for i in ids if "|" not in i and i.startswith("sensor.")]
            if candidates:
                stats = await self.call(
                    {
                        "type": "recorder/statistics_during_period",
                        "start_time": iso(start),
                        "end_time": iso(end),
                        "statistic_ids": candidates,
                        "period": period,
                        "types": ["mean", "min", "max"],
                    },
                    timeout=120,
                ) or {}
                for statistic_id, rows in stats.items():
                    parsed = self._parse_statistics(rows)
                    if parsed["t"]:
                        parsed["source"] = f"statistics:{period}"
                        result[statistic_id] = parsed
            history_ids = [i for i in ids if i not in result]
            # Raw history is expensive; the recorder keeps ~10 days by default.
            history_start = max(start, end - timedelta(days=14))
        if history_ids:
            result.update(await self._history(history_ids, history_start, start, end, points))
        return result

    @staticmethod
    def _parse_statistics(rows: list[dict]) -> dict[str, list]:
        out: dict[str, list] = {"t": [], "v": [], "mn": [], "mx": []}
        for row in rows or []:
            moment = ts_ms(row.get("start"))
            if moment is None:
                continue
            mean = to_float(row.get("mean"))
            out["t"].append(round(moment))
            out["v"].append(None if mean is None else round(mean, 2))
            low, high = to_float(row.get("min")), to_float(row.get("max"))
            out["mn"].append(None if low is None else round(low, 2))
            out["mx"].append(None if high is None else round(high, 2))
        return out

    async def _history(
        self, ids: list[str], fetch_start: datetime, bucket_start: datetime, end: datetime, points: int
    ) -> dict[str, Any]:
        plain: list[str] = []
        attribute_ids: dict[str, tuple[str, str]] = {}
        for requested in ids:
            entity_id, _, attribute = requested.partition("|")
            domain = entity_id.split(".", 1)[0]
            if not attribute and domain == "climate":
                attribute = "current_temperature"
            if not attribute and domain == "weather":
                attribute = "temperature"
            if attribute:
                attribute_ids[requested] = (entity_id, attribute)
            else:
                plain.append(entity_id)

        base = {
            "type": "history/history_during_period",
            "start_time": iso(fetch_start),
            "end_time": iso(end),
            "include_start_time_state": True,
            "significant_changes_only": False,
        }
        raw_plain: dict[str, list] = {}
        raw_attr: dict[str, list] = {}
        if plain:
            raw_plain = await self.call(
                {**base, "entity_ids": plain, "minimal_response": True, "no_attributes": True}, timeout=120
            ) or {}
        attr_entities = sorted({entity_id for entity_id, _ in attribute_ids.values()})
        if attr_entities:
            raw_attr = await self.call(
                {**base, "entity_ids": attr_entities, "minimal_response": False, "no_attributes": False}, timeout=120
            ) or {}

        start_ms = bucket_start.timestamp() * 1000
        end_ms = min(end.timestamp(), time.time()) * 1000
        result: dict[str, Any] = {}

        for entity_id in plain:
            rows = raw_plain.get(entity_id) or []
            stamped = [(ts_ms(r.get("lu") or r.get("lc")) or 0.0, r.get("s")) for r in rows]
            if entity_id.startswith("binary_sensor."):
                result[entity_id] = {"seg": segments(stamped, lambda s: s == "on", start_ms, end_ms)}
            else:
                numeric = [(t, to_float(s)) for t, s in stamped]
                result[entity_id] = bucketize(numeric, start_ms, end_ms, points)

        for requested, (entity_id, attribute) in attribute_ids.items():
            rows = raw_attr.get(entity_id) or []
            numeric: list[tuple[float, float | None]] = []
            actions: list[tuple[float, Any]] = []
            last_attrs: dict = {}
            for row in rows:
                moment = ts_ms(row.get("lu") or row.get("lc")) or 0.0
                last_attrs = row.get("a", last_attrs) or last_attrs
                unavailable = str(row.get("s", "")).lower() in UNAVAILABLE
                numeric.append((moment, None if unavailable else to_float(last_attrs.get(attribute))))
                actions.append((moment, last_attrs.get("hvac_action")))
            series = bucketize(numeric, start_ms, end_ms, points)
            if entity_id.startswith("climate."):
                series["seg"] = segments(actions, lambda a: a in ACTIVE_ACTIONS, start_ms, end_ms)
            result[requested] = series
        return result

    async def forecast(self, entity_id: str, kind: str) -> Any:
        key = f"{entity_id}:{kind}"
        cached = self._forecast_cache.get(key)
        if cached and time.monotonic() - cached[0] < 900:
            return cached[1]
        response = await self.call(
            {
                "type": "call_service",
                "domain": "weather",
                "service": "get_forecasts",
                "service_data": {"type": kind},
                "target": {"entity_id": entity_id},
                "return_response": True,
            }
        )
        forecast = (((response or {}).get("response") or {}).get(entity_id) or {}).get("forecast") or []
        self._forecast_cache[key] = (time.monotonic(), forecast)
        return forecast


# --------------------------------------------------------------------------
# HTTP layer
# --------------------------------------------------------------------------
@web.middleware
async def ingress_only(request: web.Request, handler):
    """Only accept traffic from the Home Assistant ingress proxy."""
    if SUPERVISOR_TOKEN and request.remote != INGRESS_IP:
        _LOGGER.warning("Rejected request from %s", request.remote)
        raise web.HTTPForbidden()
    return await handler(request)


class Server:
    def __init__(self, options: dict[str, Any], settings: dict[str, Any]):
        self.options = options
        self.clients: set[web.WebSocketResponse] = set()
        self.ha = HomeAssistant(options, settings, self.broadcast)
        self.demo = bool(options.get("demo_mode")) or not HA_TOKEN
        self._settings_lock = asyncio.Lock()

    def public_options(self) -> dict[str, Any]:
        keys = [k for k in DEFAULT_OPTIONS if k not in ("log_level",)]
        public = {k: self.options.get(k) for k in keys}
        public["exclude_entities"] = sorted(self.ha.excluded)
        return public

    async def broadcast(self, message: dict) -> None:
        if not self.clients:
            return
        data = json.dumps(message, separators=(",", ":"))
        for client in list(self.clients):
            try:
                await client.send_str(data)
            except (ConnectionError, RuntimeError):
                self.clients.discard(client)

    async def index(self, _request: web.Request) -> web.Response:
        html = (STATIC_DIR / "index.html").read_text("utf-8").replace("__VERSION__", VERSION)
        return web.Response(text=html, content_type="text/html", headers={"Cache-Control": "no-cache"})

    async def api_bootstrap(self, _request: web.Request) -> web.Response:
        base = {"version": VERSION, "options": self.public_options()}
        if self.demo:
            return web.json_response({**base, "demo": True})
        if not self.ha.connected.is_set():
            return web.json_response({**base, "error": "Home Assistant not connected yet"}, status=503)
        return web.json_response({**base, **self.ha.bootstrap()})

    async def api_series(self, request: web.Request) -> web.Response:
        ids = [i.strip() for i in request.query.get("ids", "").split(",") if i.strip()]
        if not ids:
            raise web.HTTPBadRequest(text="ids required")
        if len(ids) > 60:
            raise web.HTTPBadRequest(text="too many ids (max 60)")
        now = datetime.now(timezone.utc)
        end = parse_time(request.query.get("end"), now)
        hours = to_float(request.query.get("hours")) or 24
        start = parse_time(request.query.get("start"), end - timedelta(hours=hours))
        if start >= end or end - start > timedelta(days=400):
            raise web.HTTPBadRequest(text="invalid range")
        points = int(to_float(request.query.get("points")) or 288)
        points = max(12, min(points, 2000))
        try:
            data = await self.ha.series(ids, start, end, points)
        except HAError as err:
            return web.json_response({"error": str(err)}, status=502)
        return web.json_response({"start": start.timestamp() * 1000, "end": end.timestamp() * 1000, "series": data})

    async def api_forecast(self, request: web.Request) -> web.Response:
        entity_id = request.query.get("entity_id", "")
        kind = request.query.get("type", "daily")
        if not entity_id.startswith("weather.") or kind not in ("daily", "hourly", "twice_daily"):
            raise web.HTTPBadRequest(text="invalid forecast request")
        try:
            forecast = await self.ha.forecast(entity_id, kind)
        except (HAError, asyncio.TimeoutError) as err:
            return web.json_response({"error": str(err), "forecast": []}, status=200)
        return web.json_response({"forecast": forecast})

    async def api_entities(self, _request: web.Request) -> web.Response:
        if self.demo:
            return web.json_response({"error": "demo mode"}, status=409)
        if not self.ha.connected.is_set():
            return web.json_response({"error": "Home Assistant not connected yet"}, status=503)
        return web.json_response(self.ha.entity_catalog())

    async def api_settings(self, request: web.Request) -> web.Response:
        # A JSON body plus a custom header cannot be sent cross-site without a
        # CORS preflight, which this app never answers (CSRF protection).
        if request.content_type != "application/json" or request.headers.get("X-ClimatePlus") != "1":
            raise web.HTTPBadRequest(text="JSON request with X-ClimatePlus header required")
        if request.content_length is not None and request.content_length > 256_000:
            raise web.HTTPRequestEntityTooLarge(max_size=256_000, actual_size=request.content_length)
        try:
            body = await request.json()
            excluded = clean_entity_ids(body.get("exclude_entities"))
        except (ValueError, AttributeError) as err:
            return web.json_response({"error": str(err)}, status=400)
        # Entities hidden in the app configuration stay managed there.
        excluded = [e for e in excluded if e not in self.ha.option_excluded]
        async with self._settings_lock:
            try:
                save_settings({"exclude_entities": excluded})
            except OSError as err:
                _LOGGER.error("Could not save settings: %s", err)
                return web.json_response({"error": "could not save settings"}, status=500)
            await self.ha.set_app_excluded(excluded)
        _LOGGER.info("Hidden entities updated (%d hidden from the dashboard)", len(excluded))
        return web.json_response({"ok": True, "exclude_entities": excluded})

    async def api_ws(self, request: web.Request) -> web.WebSocketResponse:
        ws = web.WebSocketResponse(heartbeat=30)
        await ws.prepare(request)
        self.clients.add(ws)
        await ws.send_json({"type": "status", "connected": self.demo or self.ha.connected.is_set()})
        try:
            async for _msg in ws:
                pass  # the dashboard does not send commands
        finally:
            self.clients.discard(ws)
        return ws

    async def health(self, _request: web.Request) -> web.Response:
        return web.json_response({"ok": True, "connected": self.ha.connected.is_set(), "demo": self.demo})

    def app(self) -> web.Application:
        application = web.Application(middlewares=[ingress_only])
        application.router.add_get("/", self.index)
        application.router.add_get("/index.html", self.index)
        application.router.add_get("/api/bootstrap", self.api_bootstrap)
        application.router.add_get("/api/series", self.api_series)
        application.router.add_get("/api/forecast", self.api_forecast)
        application.router.add_get("/api/entities", self.api_entities)
        application.router.add_put("/api/settings", self.api_settings)
        application.router.add_get("/api/ws", self.api_ws)
        application.router.add_get("/api/health", self.health)
        application.router.add_static("/", STATIC_DIR, show_index=False, append_version=False)
        return application


async def main() -> None:
    options = load_options()
    logging.basicConfig(
        level=getattr(logging, str(options.get("log_level", "info")).upper(), logging.INFO),
        format="%(asctime)s %(levelname)s (%(name)s) %(message)s",
    )
    logging.getLogger("aiohttp.access").setLevel(logging.WARNING)
    server = Server(options, load_settings())
    runner = web.AppRunner(server.app())
    await runner.setup()
    await web.TCPSite(runner, "0.0.0.0", PORT).start()
    _LOGGER.info("ClimatePlus %s listening on port %d%s", VERSION, PORT, " (demo mode)" if server.demo else "")
    if server.demo:
        await asyncio.Event().wait()
        return
    async with aiohttp.ClientSession() as session:
        await server.ha.run(session)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
