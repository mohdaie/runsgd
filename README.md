# RunSGD routing

RunSGD uses the user's live GPS position as the start of a journey.

| Task | Singapore | Johor / Malaysia |
| --- | --- | --- |
| Place search | OneMap | Google Places |
| Public transport | Google Routes, after Plan | Google Routes, after Plan |
| Driving / motorcycle | Google Routes, after Plan | Google Routes, after Plan |
| Walking and live guidance | RunSGD follows the returned steps and GPS | RunSGD follows the returned steps and GPS |

The Singapore place search continues to use the existing OneMap Edge Function. The Google Routes Edge Function is in supabase/functions/runsgd-route-jb/index.ts; it accepts local Singapore and local Johor public transport requests, and road requests in either region or across the border. The name is retained for compatibility with the existing deployment and cost tracking. The app requests routes only when a commuter plans or deliberately reroutes; it does not call Google on every GPS update. A JB-to-Singapore bus/MRT plan checks up to three onward station requests.

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
