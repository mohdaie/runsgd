# RunSGD routing

RunSGD uses the user's live GPS position as the start of a journey.

| Task | Singapore | Johor / Malaysia |
| --- | --- | --- |
| Place search | OneMap | Google Places |
| Public transport | Google Routes, after Plan | Google Routes, after Plan |
| Driving / motorcycle | Google Routes, after Plan | Google Routes, after Plan |
| Walking and live guidance | RunSGD follows the returned steps and GPS | RunSGD follows the returned steps and GPS |

The Singapore place search continues to use the existing OneMap Edge Function. The Google Routes Edge Function is in supabase/functions/runsgd-route-jb/index.ts; it accepts local Singapore and local Johor public transport requests, and road requests in either region or across the border. The name is retained for compatibility with the existing deployment and cost tracking. Route planning, manual rerouting and live road traffic checks call Google; GPS progress calculations run locally. A JB-to-Singapore bus/MRT plan checks up to three onward station requests.

Border itineraries are assembled from local route legs and explicit, unmeasured immigration, border bus, parking and transfer hops. Bus 170X/170 links Woodlands Checkpoint with Kranji MRT, and bus 950 links it with Marsiling and Woodlands MRT. Google routes the onward Singapore segment from those stations. Since the app does not have live border bus waits, checkpoint queue times, or confirmed parking times, the displayed minutes are **known legs**, and the app does not claim a fastest or door-to-door ETA for such combinations. A booked KTM journey is a separate explicit option.

The user's stated sequence and travel modes filter candidates before comparison. AI interprets the request; routing providers supply the travel legs. Changing the AI model alone cannot supply missing checkpoint times.

Run the focused routing checks with:

~~~sh
node tests/checkpoint-handoff.mjs
node tests/route-provider-regions.mjs
node tests/jb-test.mjs
~~~
# Appearance

Users can choose **Current theme** or **Rounded Neobrutalism** in **More → Appearance**. The current theme remains the default. Selection applies immediately and is saved to `runsgdTheme` on the device, independent of sign-in. Guides, privacy and Admin pages inherit the same preference. The Community feed retains its dark design.

Theme assets are versioned and precached with the PWA shell. Adding a theme requires registering its identifier in `assets/theme.js`, adding scoped CSS in `assets/themes.css`, and adding a radio choice in the Appearance panel.

Browser verification: `node tests/theme-switcher.mjs` with Playwright and its Chromium browser installed. Set `RUNSGD_TEST_BROWSER` to use an existing Chromium executable. The test serves the app locally and blocks external services.

# Singapore / Johor traffic and Singapore ERP locations

During an active Singapore or Johor drive or motorcycle journey, the Google navigation map shows a `TrafficLayer`. Yellow ERP markers are available only in Singapore. Traffic and ERP switches are saved locally and default to on. Layers are detached on walking/manual hops, outside the supported region and when the journey ends. Traffic colours show Google's available coverage; the layer itself does not trigger new route calculations.

Live road ETA decreases with accepted GPS progress. Google traffic-aware route durations are distributed across road steps rather than using their static durations unchanged. Auto ETA updates default to on, with the preference saved locally. While navigation is visible and GPS is fresh and within 30 m accuracy, traffic checks run every 10 minutes, away from junctions and arrival. Update ETA also permits a manual check. Each check uses up to two Google route requests: a route through at most six anchors on the current path and an unconstrained candidate. Both are recorded as `routes_compute` in the existing usage dashboard. This adds up to 12 route requests per hour of periodic checks; manual and off-route checks can add requests. Google billing remains authoritative.

A different route is adopted only when a fresh, verified current-path estimate shows savings of at least two minutes and 15%, and the latest GPS position matches the candidate. An off-route reroute requires three distinct accurate GPS fixes over at least ten seconds, more than 70 m from the route while moving. Auto ETA off disables both automatic checks and automatic off-route rerouting; manual controls remain available. Checks have a persisted two-minute client cooldown and an additional best-effort per-function-instance user throttle (two minutes and ten checks per hour). This is not a global billing cap. Failed checks back off, retain current guidance, and indicate the failure. Responses for replaced routes, changed steps, ended journeys or background navigation are discarded. Future walking and manual checkpoint stages are preserved, and unknown border timings continue to show partial timing.

Deploy the updated `runsgd-route-jb` Supabase Edge Function together with the frontend. GitHub Pages deployment alone does not deploy this function. The new `traffic_refresh` action requires a verified signed-in user; existing function-level `verify_jwt=false` is retained for compatibility with other actions. Focused checks use mocked external services and make no paid Google calls:

~~~sh
node tests/live-traffic.mjs
node tests/traffic-route-service.mjs
RUNSGD_TEST_BROWSER=/path/to/chromium node tests/live-traffic-browser.mjs
~~~

ERP geometry is bundled in `assets/singapore-erp.json`, derived from [LTA's September 2026 gantry file](https://datamall.lta.gov.sg/content/dam/datamall/datasets/Geospatial/ERPGantry_Sep2026.zip). The builder transforms SVY21 coordinates to WGS84, keeps only `TYP_CD=P` (ERP) and removes identical spans, leaving 101 distinct geometries. The source date, hash and attribution are included in the JSON and the date is displayed in marker details. Non-ERP EMAS, directional and height-limit gantries are excluded.

Warnings require an intersection of the planned road polyline with the actual ERP span, two distinct accepted GPS fixes, accuracy and route offset within 30 m, and GPS age within 6.5 seconds. The warning appears 500–800 m before the crossing, depending on speed, and clears when GPS becomes unreliable, the driver leaves the route, or the location is passed. Heading is compared with the current route tangent. A walking/manual boundary prevents warnings for a later drive leg; a reroute rebuilds the crossing list. Repeated UI updates do not count as additional GPS fixes.

These are location advisories, not live ERP operation or payment detection. The dataset has no travel direction or current charging status, and road polylines have no reliable elevation. Geometry can therefore miss a crossing or confuse vertically separated roads. Rates, operating hours and ERP 2 charging zones are not inferred. Refresh the location dataset when LTA publishes a new file, including updating the builder's source metadata and the popup date. ERP lookups and GPS warning calculations do not call a paid API; existing Google map usage still applies.

To reproduce the bundled geometry from the source ZIP:

~~~sh
python -m pip install pyshp pyproj
python scripts/build-singapore-erp.py /path/to/ERPGantry_Sep2026.zip
node tests/singapore-road-alerts.mjs
RUNSGD_TEST_BROWSER=/path/to/chromium node tests/car-navigation-browser.mjs
node tests/pwa-shell.mjs
~~~

The browser test uses renderer fixtures and real bundled ERP geometry, with external services blocked. It checks actual GPS reconciliation, switches, marker dialogs, stale GPS, the Singapore boundary, non-driving leg boundaries, map cleanup and mobile layouts in both themes. Live traffic tile coverage and field GPS accuracy require an on-device check after deployment.

## Landing page and app URLs (v2.17.0)

The public landing page is `/`; the app is `/app/` (GitHub Pages redirects `/app` to its directory URL). The eight approved sections use responsive HTML/CSS and the approved artwork, served as three WebP files totalling about 760 KB. Artwork is shown in CSS viewports; text, calls to action, pricing, navigation and FAQ are native HTML. Landing visits do not start Supabase, Google Maps or AI requests.

The manifest keeps the existing `id: /` and root scope, and launches `/app/`. Root app tab links, installed root PWAs, old app update URLs and OAuth callbacks are bridged to `/app/` with query and fragment intact. The existing Supabase-allowed root OAuth callback remains valid. App update probes and both rescue pages now target app HTML. Session and journey storage keys remain unchanged. Live Journey screens are still protected from worker refreshes. Admin, guides and repair routes retain their current URLs.

The service worker caches marketing and app HTML separately, normalizes app directory/index aliases, and never falls back between them. Deploy the small `extensive-health` endpoint change with the frontend so deployment monitoring checks `/app/index.html`.

Checks:

```sh
node tests/landing-routes.mjs
node tests/pwa-shell.mjs
RUNSGD_TEST_BROWSER=/path/to/chromium node tests/landing-browser.mjs
```
