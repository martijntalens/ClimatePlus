# ClimatePlus

ClimatePlus gives you one overview of the climate in your whole home. It finds
your sensors automatically and shows live values, trends, history and advice.

## Getting started

1. Start the app and enable **Show in sidebar**.
2. Open **ClimatePlus** from the sidebar.

For the best result, assign your climate sensors (or their devices) to
**areas**, and your areas to **floors** in Home Assistant
(**Settings → Areas, labels & zones**). ClimatePlus groups everything per area
and shows the areas per floor.

## How sensors are detected

| Type | Detected from |
|---|---|
| Temperature, humidity, CO₂, VOC, PM1/PM2.5/PM10, CO, NO₂, ozone, AQI, light, air pressure, noise | `sensor` entities by `device_class` (or by unit, e.g. `°C`, `lx`, `ppm`, `hPa`) |
| Thermostats | `climate` entities (current temperature, target, heating state) |
| Windows & doors | `binary_sensor` with device class `window`, `door`, `opening` or `garage_door` |
| Lights, fans, humidifiers | `light`, `fan`, `humidifier` entities |
| Outdoor | Areas or entities named e.g. *Buiten, Tuin, Balkon, Terras, Outdoor, Garden*, and sensors of weather services without an area (Buienradar, Met.no, OpenWeatherMap, …); otherwise the weather entity |
| Weather & sun | `weather.*` (prefers `weather.home`/`weather.forecast_*`) and `sun.sun` |
| Batteries | Battery sensors of devices that also have a climate sensor |

Diagnostic entities (for example a router's CPU temperature) and boiler water
pressure sensors are ignored. If an area has a **temperature/humidity sensor
selected in its area settings**, that sensor is used as the primary sensor for
the room.

### Entities without an area

Entities that are not assigned to an area (neither the entity nor its device),
for example your phone's light and pressure sensors, are shown in a separate
**No area** list. They are shown one by one: they are **not** averaged, not
scored and not included in the house figures or advice. Assign them to an area
in Home Assistant, or hide them on the settings page.

## Using the charts

Hover a chart with the mouse to see the values at that moment. On a phone or
tablet, **tap** a point to keep its values on screen until you tap somewhere
else; drag sideways to move through the chart. The dashboard does not refresh
the page while a value is shown.

## Hiding entities

Open the **settings page** (gear icon at the top right) and tick the entities
you do not want to see. Use the search box or the *No area* filter to find them
quickly, then press **Save**. Hidden entities disappear from every view, chart
and piece of advice. The selection is stored by the app in its own data folder;
nothing changes in Home Assistant.

Entities listed in the `exclude_entities` option are hidden as well. They are
shown as *Via configuration* on the settings page and can only be changed in the
app configuration.

## Options

| Option | Default | Description |
|---|---|---|
| `language` | `auto` | `auto` follows the Home Assistant language, or force `nl` / `en`. |
| `temperature_comfort_min` / `_max` | `19.5` / `22.5` | Comfortable indoor temperature range (°C). |
| `humidity_comfort_min` / `_max` | `40` / `60` | Comfortable relative humidity range (%). |
| `co2_warning` | `1000` | CO₂ (ppm) at which ventilation is advised. |
| `co2_critical` | `1400` | CO₂ (ppm) that counts as poor air. |
| `stale_sensor_hours` | `6` | Flag sensors that did not report for this long. |
| `low_battery_percent` | `20` | Flag climate sensors with a lower battery level. |
| `weather_entity` | – | Weather entity to use (auto-detected when empty). |
| `outdoor_temperature_entity` | – | Sensor that overrides the outdoor temperature. |
| `outdoor_humidity_entity` | – | Sensor that overrides the outdoor humidity. |
| `exclude_entities` | `[]` | Entity IDs to hide from the dashboard. Usually easier on the settings page (see *Hiding entities*). |
| `demo_mode` | `false` | Show generated demo data instead of your own sensors. |
| `log_level` | `info` | `debug`, `info`, `warning` or `error`. |

Example:

```yaml
language: nl
temperature_comfort_min: 20
temperature_comfort_max: 22
weather_entity: weather.forecast_home
exclude_entities:
  - sensor.fridge_temperature
  - sensor.freezer_temperature
```

## What the numbers mean

- **Comfort score (0–100)** per room combines temperature (40 %), humidity
  (25 %) and air quality (35 %, the worst of CO₂/PM/VOC/CO). One bad aspect
  caps the score, and a high mould risk caps it at 65.
- **Dew point** and **absolute humidity** (g/m³) are calculated with the Magnus
  formula from temperature and relative humidity.
- **Ventilation guide**: airing only dries a room when the outdoor air contains
  fewer grams of water per m³ than indoor air. In winter this is almost always
  the case, even when the outdoor relative humidity is 90 %.
- **Cold-corner humidity / mould risk** estimates the surface temperature of the
  coldest spot of an outer wall with temperature factor fRsi = 0.7
  (`T_surface = T_out + 0.7 × (T_in − T_out)`) and the relative humidity at
  that surface. Above 80 % mould can grow.
- **Trends** shorter than 7 days use the recorder history (time-weighted
  averages). Longer ranges use Home Assistant **long-term statistics**, which
  only exist for sensors with a `state_class`.

## Security

- Only reachable through Home Assistant ingress (requires a logged-in Home
  Assistant user). The app exposes no ports and rejects requests that do not
  come from the ingress proxy.
- Read-only use of the Home Assistant API; it does not control devices or
  change anything in Home Assistant. The only thing the app writes is its own
  list of hidden entities (`/data/settings.json`, entity IDs only).
- Changing settings requires a JSON request with a custom header, which a
  different website cannot send through your browser (CSRF protection).
- No external network requests; all assets are bundled.

## Troubleshooting

- **A room is missing** – make sure the sensor or its device is assigned to an
  area. Sensors without an area appear under *No area*.
- **No 30-day / 1-year history** – the sensor needs a `state_class` (usually
  `measurement`) for long-term statistics.
- **Wrong outdoor temperature** – set `outdoor_temperature_entity`.
- Check the **Log** tab of the app; set `log_level: debug` for details.
