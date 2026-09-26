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
