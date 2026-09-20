# JB independent navigation pilot — v2.13.0

Open `/jb-test/` or Journey → JB Map Test. Pick a start and destination on the map, preview the driving route, then use Start GPS test at the route start. GPS tracking only runs while this test page is active; back returns to Journey. Test locations and routes are not persisted into production journey history.

- MapLibre GL JS 5.6.2 renders OSM raster tiles. Custom RunSGD instruction panel, route and GPS marker. Raster road labels/colours are supplied by OSM, not fully custom vector styling.
- FOSSGIS public OSRM car endpoint supplies independent OSM-based route geometry and maneuvers. No Google coordinates, routes, keys or API calls are reused.
- RunSGD pilot tracking rejects poor/stale/out-of-order fixes, uses distance/heading/progress to select a route segment, rejects implausible jumps, requires two fixes to pass a maneuver and three accurate endpoint fixes to arrive. It is experimental route matching, not lane-level navigation.
- A manual Reroute request obtains fresh GPS and replaces the full route. No background routing polls. Requests are limited to one per five seconds per page. No live traffic ETA, offline maps, motorcycle, walking, or cross-border routing support.
- Scope: local JB road journeys within the configured coordinate bounds. Bounds are a pilot coverage guard, not an administrative boundary dataset.

## Service limits

This is a small-scale public-service pilot, not a self-hosted routing backend. Before wider use, replace the FOSSGIS endpoint with a managed/dedicated OSRM service and configure a supported tile provider or self-hosted tiles. Per-client throttling is not a global quota for a shared public service. Do not promote this pilot for mass use. FOSSGIS permits max 1 request/second and no heavy usage: https://routing.openstreetmap.de/about.html

OSM tiles are loaded only for the displayed viewport, with normal browser caching, visible attribution and referrer. No offline download, prefetch, bulk tile collection or proxy: https://operations.osmfoundation.org/policies/tiles/

Routing coordinates are sent to FOSSGIS; viewport tile requests go to OSM; MapLibre assets load from unpkg. The UI explains this before starting. OSM raster tiles and the routing graph may be updated at different times.

## Verification

`node tests/jb-test.mjs`

Covers response adaptation, left/right maneuver consistency, route coverage rejection, poor/stale GPS, off-route fixes, implausible jumps, two-fix turn confirmation and arrival confirmation. Field validation around JB flyovers, parallel roads, exits and entrances is still required. No Google routing or existing production navigation changes.
