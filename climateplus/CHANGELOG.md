# Changelog

## 1.2.0

- Charts on phones and tablets: tap a point to keep its values on screen until
  you tap somewhere else. Drag sideways to move through the chart; swipe up or
  down to scroll the page. Works for line charts, the heatmap and the comfort
  chart.
- Long-pressing a chart no longer starts text selection or the context menu.
- Comfort chart points are easier to hit with a finger.
- The heatmap sensor picker no longer sticks out of the card on small screens.

## 1.1.1

- Fix: the dashboard reloaded every few seconds when Home Assistant has
  climate-like entities that ClimatePlus skips on purpose (for example the
  diagnostic device temperature of Zigbee plugs). Dashboards now only reload
  when areas, devices or the set of shown entities actually change.
- Live updates no longer redraw the page while you hover or touch a chart, keep
  the scroll position, and skip redraws when nothing visible changed.

## 1.1.0

- Entities without an area are no longer averaged into a "No area" room. They
  are listed one by one and no longer count towards the house averages,
  comfort score, warmest/coldest room or advice.
- Sensors of weather services without an area (Buienradar, Met.no,
  OpenWeatherMap, …) are now treated as outdoor sensors.
- New settings page (gear icon): pick the entities to hide from a searchable
  list instead of typing entity IDs. The selection is stored by the app; the
  `exclude_entities` option keeps working.

## 1.0.0

- First release.
- Live overview with house comfort score, indoor/outdoor, humidity, air quality, light & sun and weather forecast.
- Room cards per floor with sparklines, trends, thermostat, window, light and fan status.
- Insights & advice: window open while heating, CO₂ ventilation, airing advice based on absolute humidity, mould risk, temperature extremes, frost, stale/unavailable sensors and low batteries.
- Trends for every metric over 24 h – 1 year (history + long-term statistics) with CSV export.
- Hour × day heatmap with average daily profile.
- Comfort chart (temperature × humidity) with 24 h trails, ventilation guide and comfort table.
- Room detail pages with heating and window-open periods.
- Sensor health overview.
- Dutch and English, light/dark theme following Home Assistant, demo mode.
