# senTRA — Stage 4.5 geospatial upgrade handover

> Historical geospatial handover. The [project overview](README.md) and [technical reference](docs/PROJECT-REFERENCE.md) provide the current repository introduction and safety boundaries.

**Deliverable:** a separately previewed upgrade of the existing senTRA prototype, retaining GEOACCESS, REFLEX, MAMA-GUARD and the platform workspaces. The historical [architecture audit and plan](docs/STAGE4.5-AUDIT-PLAN.md) describes the pre-upgrade baseline; this handover describes what was implemented. The later [satellite and globe visual update](HANDOVER-SATELLITE-MAP.md) adds optional imagery, provider controls and a no-detail fallback; its description supersedes this document where they differ.

> **Demonstration only. Never enter real patient information.** This is not an operational digital twin, a healthcare facility directory, an emergency service, a routing system or a validated clinical/public-health tool. Fictional facility examples, service tags, referrals and access calculations must not be used to choose care or allocate resources. An OpenStreetMap health point is unverified and does not establish that a facility is open, equipped or appropriate.

## 1. What changed

- **Progressive geographic exploration:** GEOACCESS can focus from Nigeria to a state/FCT, an LGA, a sampled community and a selected fictional facility or mapped healthcare point. Maps zoom to street scale, with 2D/3D, pitch, rotation, scale, reset and expand controls. A selected fictional facility retains its existing senTRA ID and cross-module return path.
- **Real geographic context, subject to source coverage:** optional OpenStreetMap / OpenMapTiles vectors via OpenFreeMap add roads, water, place/road names, footprints and mapped health points. The optional Mapzen bare-earth DEM provides relief in 2D and terrain in 3D. Coverage can be sparse even when a provider is working; absent features do not prove that nothing exists.
- **Conservative 3D:** mapped buildings with a positive, non-default `render_height` and no `hide_3d` flag may be extruded. Heights may be inferred from levels and are approximate, not survey measurements. OpenMapTiles' ambiguous 5 m default remains flat, including genuine 5 m buildings that cannot be distinguished. Missing building or terrain data are not manufactured. The former density-height extrusion was removed from GEOACCESS and Operations; modeled population remains a separately controlled raster. The Stage 1 command map retains its separately labelled analytical deck.gl overlay.
- **Separate healthcare layers:** the 111 senTRA facilities are fictional. Purple OSM healthcare points are separately labelled **unverified**: they are not NHFR records, are not matched to senTRA IDs and are excluded from REFLEX, MAMA-GUARD, accessibility and scenario calculations. Observation dates, operational status, ownership, services and readiness are unknown. Tile feature IDs are not stable registry IDs. In Facility Explorer, a keyboard-accessible list offers up to 12 points currently rendered in the viewport—not a complete inventory.
- **Synthetic overlays:** independent controls show example population density, facility points, sample settlements, radius catchments, gap candidates, synthetic REFLEX connections and fictional maternal/emergency tags. Connections aggregate submitted examples by directed origin/destination pair and are drawn as straight dashed segments, **not road routes**. A facility's context shows incoming/outgoing synthetic counts and nearby matching fictional facilities and sampled settlements, with great-circle distances. Live public-health incidents, verified travel time, readiness and real emergency response remain unavailable.
- **Shared foundation:** `src/components/map/geographicContext.ts` supplies the optional source/layer installer and status/retry logic to GEOACCESS, Operations, the Stage 1 command map and REFLEX's geographic network. MAMA-GUARD reuses the GEOACCESS map for its fictional facility examples; mapped OSM health points are disabled there. No new map engine or live health backend was introduced.

## 2. Try the workflow

1. Open **GEOACCESS → Spatial Overview**. Select **Ondo** using the shared selector, then choose **Akoko North East** in the LGA list. Choose **Aba Omoode** from the GRID3 sample-community list and switch between 2D and 3D. The sample is partial and non-representative; it is not a complete town directory. This example may have little OSM building detail.
2. Open **Facility Explorer**. Fictional facility examples are green and retain synthetic identifiers. For a street-level example of unverified mapped health context, select **Lagos → Lagos Island**, zoom in, and use **Mapped health points** when points are visible. Availability, tile contents and labels may change. Purple points cannot be handed off as verified facilities.
3. In **Geographic context & tags**, toggle roads, water, buildings, terrain, mapped health points, synthetic referral connections, and maternal/emergency example tags. The legend and source-status strip reflect the chosen layers. Adjust the radius only as an illustrative great-circle distance; it is not a healthcare standard or travel time.
4. In REFLEX, create and submit a **synthetic** example between fictional facilities. No facility or person is contacted. GEOACCESS and Operations read the validated local REFLEX examples, update on cross-tab storage/focus events, and show only edges whose two endpoints are in the current facility filter. If REFLEX has not been opened, an **unsaved demonstration seed** is used in memory. An unreadable or blocked store is reported rather than treated as an empty operational network.
5. Use **Use local map only** in the map source strip to pause optional online geography; the choice is shared and persisted when localStorage is available. **Retry sources** recreates failed sources and requests them again. If storage is blocked, the choice may be memory-only and reset on a later mount or reload: it is not a privacy guarantee.

## 3. Data sources and limitations

| Layer | Source and meaning | Key limitations |
| --- | --- | --- |
| State/FCT and LGA boundaries | GRID3 / geoBoundaries, 2022; 37 ADM1 areas and 774 LGAs; CC BY 4.0 | Simplified, joined approximately, published but not independently verified. |
| Wards | GRID3 2026 operational ward display subset; CC BY-SA 4.0 | 9,306 display polygons, 29 unusable/missing geometries omitted and some repaired; provider-reported defects and border gaps. Inspection only; not used for ward-level calculations. See `public/data/geoaccess/wards/ATTRIBUTION.txt`. |
| Population | WorldPop 2020 modeled population and derived density; CC BY 4.0 | Not a census, current population, demand or capacity. Aggregation and boundary joins add uncertainty. |
| Sample settlements | GRID3 2021 settlement-name data, 2,924 systematically sampled records; CC BY 4.0 | Approximately 1% of the source, not random or necessarily representative. Coordinates/names not independently verified. |
| Synthetic facilities and referrals | 111 fictional facility examples; 222 seeded REFLEX referrals plus local edits | Not real locations, services, people, availability or observed events. Browser storage is unencrypted and unauthenticated. |
| OSM context, including mapped health POIs | © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), via [OpenMapTiles](https://openmaptiles.org/) and [OpenFreeMap](https://openfreemap.org/) | ODbL; coverage, freshness and completeness vary. Public tiles are a rolling snapshot with no SLA. Mapped roads are not a route graph; mapped POIs are not a verified registry or matched facility IDs. Follow [provider terms](https://openfreemap.org/tos/); the app does not bulk-download tiles. |
| Terrain | [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/), Terrarium DEM, including source-dependent USGS SRTM/GMTED2010 and NOAA credits | Mixed vintage and resolution, bare-earth model; accuracy varies. See [Tilezen source attribution](https://github.com/tilezen/joerd/blob/master/docs/attribution.md). It is not a local building or infrastructure survey. |

Full source details and checksums are in `public/data/geoaccess/manifest.json`, `public/data/ATTRIBUTION.md` and the GEOACCESS provenance panel. The NHFR, verified readiness, road-routing service, live surveillance, capacity, staffing and stock feeds are **not connected**.

## 4. Online, offline and privacy behaviour

Online context is **enabled by default**. The browser contacts OpenFreeMap for vector tiles/font glyphs and AWS for DEM tiles. These services receive the viewer's IP and tile/viewport requests; the map does not send patient or referral records to them. A geographic viewport can itself be sensitive. Public providers can fail or change, and the status indicators are not guarantees of coverage or accuracy. Source errors leave the local map in place, show unavailable/partial status and expose retry; tilt alone does not prove that terrain is available.

In a production build, the service worker precaches the same-origin shell, emitted assets and MapLibre worker, then caches **visited public local GEOACCESS derivatives on demand**. Successfully fetched local JSON from a first visit is also requested after initial worker control so it can be cached. Previously visited states/layers may reopen offline; an unvisited regional dataset reports an explicit error. The worker does **not** cache OpenFreeMap vectors, DEM tiles, remote glyphs, API responses or patient data. Browser/provider HTTP caching is separate; do not rely on third-party maps being available offline. A secure context (HTTPS or localhost), a successful first online load and permitted browser storage are required for offline operation.

MAMA-GUARD examples remain memory-only and clear on reload. REFLEX synthetic examples remain in unauthenticated, unencrypted localStorage when available; cross-tab writes are last-writer-wins. Local-only preference, simulated roles and consent are not security boundaries. No real patient data should be entered anywhere.

## 5. Validation actually performed

The final isolated production build was exercised at the Stage 4.5 preview while previous Stage 4 previews remained separate.

- **Type/data/core:** TypeScript passed; Stage 1 data, GEOACCESS, REFLEX, platform and MAMA-GUARD core suites passed. GEOACCESS checked 774 LGAs, 9,306 wards, 2,924 settlement samples, 18,756 population cells, 111 fictional facilities and 160 checksums. REFLEX checked 222 synthetic seeds. `npm audit --omit=dev` reported zero vulnerabilities at the time of the check.
- **Stage 4.5 online browser suite:** national → Ondo → Akoko North East → Aba Omoode → Lagos Island mapped point; real vector and DEM responses, independent layer controls, 3D, same-route facility handoff, local-only persistence and mobile widths 320/390/768 px passed. In one development-only Lagos renderer inspection, terrain, mapped roads/water and non-default-height building extrusions were present; that single viewport is not a coverage estimate.
- **Failures and recovery:** blocking both optional providers and blocking vector tiles alone retained the local map, reported the failed source and recovered after retry. A local-only reload made no optional provider requests. Third-party availability is outside the project's control.
- **Saved REFLEX overlay:** a new fictional REFLEX submission increased the chosen facility's outgoing count from 2 to 3 and the in-filter directed connections from 3 to 4 across GEOACCESS and Operations tabs. GEOACCESS retained the update after reload. A development-only MapLibre inspection verified the new synthetic line and its non-patient properties. Nothing was transmitted.
- **Production offline:** the first-visit worker-claim case, visited Ondo/LGA/community, worker packaging, local 3D fallback, unvisited Lagos error, locked platform safety and MAMA memory-only behaviour passed. External map tiles were absent from the service-worker cache.
- **Existing browser regressions:** GEOACCESS, shell, REFLEX, Operations/platform and MAMA-GUARD desktop/mobile suites passed against Stage 4.5. After the final Operations cross-tab refresh change, its platform/browser/offline suites and the new shared-referral test were rerun successfully. Expected aborted optional tile requests were logged during some route changes; no uncaught desktop browser errors were recorded.
- **Clean-install verification:** a source-archive candidate was extracted into a fresh directory. Node 22 `npm ci`, the full `npm run build`, all five core suites, the Stage 4.5 offline/referral browser suites and the production dependency audit passed. Its 216 build files matched the tested isolated production bundle byte-for-byte. `npm ci` warned that Recharts 2.x is no longer an active branch; a migration and chart regressions remain future work.

These checks do not certify map accuracy, provider uptime, accessibility conformance, clinical safety, privacy, security or production readiness.

## 6. Screenshots

Captured from the production preview with synthetic examples; optional map contents can change:

- [01 National](docs/previews/stage45/final/01-national.png) · [02 Ondo](docs/previews/stage45/final/02-state-ondo.png) · [03 Akoko North East LGA](docs/previews/stage45/final/03-lga-akoko-north-east.png)
- [04 Aba Omoode sample community](docs/previews/stage45/final/04-community-aba-omoode.png) · [05 Unverified OSM mapped point](docs/previews/stage45/final/05-facility-osm-unverified.png) · [06 Fictional facility and preserved ID](docs/previews/stage45/final/06-facility-synthetic.png)
- [07 Operations](docs/previews/stage45/final/07-operations.png) · [08 Mobile map](docs/previews/stage45/final/08-mobile-map.png)

## 7. Run and maintain

Use Node.js 22 or newer and a WebGL 2-capable browser:

```bash
cd sentra
npm ci
npm run dev
# Alternatively:
npm run build
npm run preview
```

Install the Playwright browser with `npx playwright install chromium` for browser tests. Set `SENTRA_URL` to the running instance; run suites serially on memory-constrained machines. `test:stage45:e2e` needs the optional providers; `test:stage45:offline`, `test:offline`, `test:platform:offline` and `test:mamaguard:offline` require a production preview. For development-only layer inspection, set `STAGE45_DEBUG=1`; the opt-in map debug hook is absent in production. See the README for all test commands. The application assumes deployment at the site root; the permissive development/preview host settings are for the sandbox and must be hardened before deployment.

Further work requires authorised and regularly maintained facility and operational data, verified routing and access measurements, service agreements, privacy/security engineering, independent accessibility and clinical review, governance, and real deployment infrastructure. This prototype does not provide those capabilities.
