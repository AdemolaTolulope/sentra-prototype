# senTRA — satellite, globe and close-up map update

> Historical imagery handover. Start with the [project overview](README.md) and [technical reference](docs/PROJECT-REFERENCE.md) for the current summary and safety boundaries.

This update responds to the request for a more convincing globe, better zoomed-in map graphics and clearer evidence/uncertainty cues. It builds on the [Stage 4.5 handover](HANDOVER-STAGE4.5.md) without changing its synthetic healthcare data or its safety boundaries.

> **Demonstration only.** Facility examples, service tags and referral connections are fictional. Separately mapped OpenStreetMap healthcare points are unverified and do not establish services or readiness. Do not enter real patient information or use this app for care, routing, emergency response or resource allocation.

## What is new

- **Satellite / Map:** a switchable photographic basemap alongside the existing mapped roads, boundaries and analytical layers. The GEOACCESS map is also reused in Operations and MAMA-GUARD; the Stage 1 command map and REFLEX's separate geographic map retain their Stage 4.5 mapped context and do not acquire this new imagery UI.
- **Interactive globe:** use **Globe** to zoom out to a satellite Earth centered on Africa. **Focus Nigeria** returns to the national view. At street scale use 2D/3D, tilt, rotate, zoom, reset and expand. The globe is a MapLibre projection, not a separate photograph or a healthcare model.
- **Real, but uneven, detail:** the default global demonstration layer is EOX's 2024 Sentinel-2 cloudless mosaic at approximately 10 m/pixel. At zoom 13+, the browser searches the OpenAerialMap STAC catalogue for eligible scenes intersecting the viewport; selected individual scenes are overlaid and their title, contributor, capture date, resolution, licence and catalogue link are shown. Only scenes with a named producer, title and `CC-BY-4.0` or `CC-BY-NC-4.0` licence are used. Up to eight matches are displayed; a notice appears if results are truncated. Bounding-box intersection does **not** establish detailed imagery at every visible pixel or validate its accuracy.
- **Honest fallback:** at close range (zoom 14+) with no eligible scene or an unavailable catalogue, the map shows mapped context rather than silently enlarging a coarse photograph. The panel labels this a map, not an image; **Show low-resolution satellite** explicitly restores the 10 m mosaic if desired. An unavailable basemap leaves the local map and separate source status in place. Images are historical, not live.
- **Practical preview:** **Preview Lagos detail** navigates to a tested location covered by the Maxar 2019 Lagos Mosaic (~0.5 m/pixel, CC BY-NC 4.0). This is an example, not a guarantee of city-wide, Ondo or national detailed coverage. Spot checks found no eligible detailed scene at the tested Ikare and Aba Omoode areas. OpenAerialMap and EOX availability may change.
- **3D limits:** the DEM supplies approximate bare-earth terrain when available. Only mapped OSM buildings with eligible non-default heights are extruded, as simple translucent blocks. They are not surveyed or photorealistic 3D models. Sparse/missing features are not evidence that buildings or services are absent.

## Imagery rights and the optional provider

The bundled configuration is a **non-commercial imagery demonstration**. EOxCloudless 2024 is [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) with the required on-map credit: EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024). EOX's hosted service and commercial use have separate conditions; see [EOX's terms](https://cloudless.eox.at/documentation/license). OpenAerialMap sources carry the licence for each individual scene, which can also prohibit commercial use. Check permissions and credits before publishing or deploying; do not assume that a freely accessible tile is unrestricted.

To use a different, broader-coverage service, open **Connect wider high-resolution imagery**, enter your own **MapTiler browser key**, and select **Connect**. MapTiler replaces the EOX/OpenAerialMap imagery; the map shows its required logo and TileJSON attribution. Check the provider's coverage, plan, pricing, current terms and permitted use. No key is included, and the actual MapTiler account/service was not tested; success and failure handling were tested with mocked responses. Browser keys are visible to users and MapTiler, so restrict them to approved domains. When browser session storage is available, a manually entered key is stored for the current tab; otherwise it remains in memory for that mounted map. **Remove** clears it for that session. A build-time alternative is `VITE_MAPTILER_KEY` in the Vite environment; any such value is public in the resulting browser bundle, not a secret.

Full references are in [public/data/ATTRIBUTION.md](public/data/ATTRIBUTION.md). Provider-reported resolution and scene dates are metadata, not independent verification of the visible pixels.

## Online/offline and privacy

With online geography enabled, EOX, OpenAerialMap, OpenFreeMap, Mapzen and (if configured) MapTiler may receive the viewer's IP address and the requested map area. No patient or referral records are sent to imagery services, but the geographic viewport can itself be sensitive. **Use local map only** pauses optional geography/imagery requests and persists the preference where localStorage works; if storage is blocked the preference can reset on a later mount. The app's service worker does not cache third-party tiles, imagery, catalogues or glyphs. Browser HTTP caches are separate. Previously visited local geography may work offline, while uncached local datasets and remote imagery can remain unavailable. The prototype provides no privacy or security guarantee.

## Validation

- An isolated production build and browser test loaded **63** real Sentinel-2 tiles, **26** OpenAerialMap detail tiles and **3** successful catalogue searches in one run. It displayed the Lagos scene's Maxar attribution/date/licence, exercised globe and 3D controls, and confirmed the Ondo close-up fallback and coarse-imagery override. These counts are test observations, not coverage or availability guarantees.
- The provider-key flow was tested using **mocked** MapTiler success and HTTP 403 responses, including logo/attribution, key removal and a local-only reload with zero optional provider requests. A real MapTiler key/service was not tested.
- The Stage 4.5 online regression passed in production; a separate development run also inspected actual Lagos terrain, road/water and non-default-height building layers. National → Ondo → LGA → community → Lagos mapped POI, independent overlays, failure/recovery and mobile layouts passed.
- Existing foundation, GEOACCESS, REFLEX, platform/Operations and MAMA-GUARD desktop/mobile browser suites passed against the isolated production preview. The cross-tab REFLEX → GEOACCESS/Operations synthetic-referral regression passed; no facility was contacted. Production offline checks reopened visited public geography, reported an uncached region unavailable and confirmed that external geography/imagery was not stored by the service worker. Foundation, platform and MAMA-GUARD offline suites passed.
- TypeScript, Stage 1 data, GEOACCESS, REFLEX, platform and MAMA-GUARD core suites passed; `npm audit --omit=dev` found zero vulnerabilities at the time of the check. The packaged project was also checked by extracting it, installing its locked dependencies with Node 22, rebuilding, running the core suites and comparing generated files with the tested production build.
- Tests do not certify map accuracy, source coverage, licensing for a particular deployment, accessibility conformance, privacy, clinical safety or production readiness.

Representative screenshots: [national](docs/previews/satellite/final/01-national-satellite.png), [globe](docs/previews/satellite/final/02-globe.png), [Lagos detail](docs/previews/satellite/final/03-lagos-detail.png), [Lagos 3D](docs/previews/satellite/final/04-lagos-3d.png), [Ondo fallback](docs/previews/satellite/final/05-ondo-map-fallback.png), and [mobile globe](docs/previews/satellite/final/06-mobile-globe.png).

## Run and check

Requires Node 22+, npm and a WebGL 2-capable browser. No credentials or backend are needed for the non-commercial demo.

```bash
npm ci
npm run dev
# Production build and preview:
NODE_OPTIONS=--max-old-space-size=768 npm run build
npm run preview
# With a running instance (Playwright Chromium installed):
SENTRA_URL=http://127.0.0.1:5173/ npm run test:satellite:e2e
```

The satellite suite depends on external EOX/OpenAerialMap availability and also runs deterministic provider/opt-out mocks. `SATELLITE_DEBUG=1` is only for the Vite development server and enables additional renderer assertions. See the README for core, regression and production-offline suites. External services can fail or change; source status and a local fallback are not proof of coverage.
