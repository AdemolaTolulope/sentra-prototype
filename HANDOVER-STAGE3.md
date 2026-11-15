# senTRA Stage 3 — REFLEX handover

> Historical snapshot: this document describes Stage 3 at its review date. For the current MAMA-GUARD implementation, see [HANDOVER-STAGE4.md](HANDOVER-STAGE4.md).

**Status:** interactive, local synthetic demonstration. Stage 1 Foundation and Stage 2 GEOACCESS remain in place; Stage 4 has not been started and requires your review and approval. This is not an operational healthcare system or a university endorsement, deployment or partnership.

## Open and navigate

Use the Arena **senTRA Stage 3 · Production preview** and choose **REFLEX** in the sidebar. The nine workspaces are in the horizontal tab strip. On a narrow screen, scroll the strip or use the arrow keys; the active tab is brought into view. The global geography selector and the expandable shared filters operate on the synthetic data. Examples of direct links: `/#/reflex?tab=command`, `#/reflex?tab=create`, `#/reflex?tab=network`, `#/reflex?tab=analytics`, `#/reflex?tab=simulation`.

From the source archive, install Node.js 22 or newer and use:

```bash
npm ci
npm run dev
# For the production build and its offline service worker:
npm run build
npm run preview
```

Open the Vite address, normally `http://localhost:5173/`. The map requires WebGL 2. The service worker assumes deployment at the origin root and HTTPS or localhost. The permissive preview host configuration is for the sandbox, not a deployment security policy.

Screenshots are included in `docs/previews/`: [command centre](docs/previews/reflex-command-centre.png), [creation](docs/previews/reflex-create.png), [matching](docs/previews/reflex-matching.png), [network](docs/previews/reflex-network.png), [geographic pathways](docs/previews/reflex-geographic.png), [tracking](docs/previews/reflex-tracking.png), [counter-referral](docs/previews/reflex-counter.png), [follow-up](docs/previews/reflex-followup.png), [analytics](docs/previews/reflex-analytics.png), [simulation](docs/previews/reflex-simulation.png), and [mobile](docs/previews/reflex-mobile.png). They show fictional examples, not observed care.

## Nine connected workspaces

| Workspace | Working synthetic demonstration |
| --- | --- |
| **Command Centre** | Status, in-transit, received, follow-ups-due, counter-referral-pending, completion, activity, origin, service, receiving workload and review signals, with shared filters and drill-downs. |
| **Create Referral** | Synthetic reference, fictional facilities, service and optional extra capability tag, priority, reason, predefined context, simulated permission, administrative notes and dates; validate, review, draft, edit or locally submit. A minimal text summary downloads and an ID-only QR is displayed. |
| **Facility Matching** | Explain and compare fictional tag-compatible candidates; show per-candidate exclusion reasons, score components, estimated straight-line distance and missing availability. A person selects a destination. |
| **Referral Network** | Directed D3 graph, zoom/pan and keyboard-selectable nodes/edges; inspect connections, concentration, high inbound volume, low connectivity and straight-line geographic connections. |
| **Referral Tracking** | Searchable local register, details and chronological simulated role-context events. Only permitted status transitions are offered; rejection requires a fictional administrative reason. |
| **Counter-Referral** | Record simulated receipt, service completion/category, administrative outcome and follow-up plan, return, date and notes. A separate local acknowledgement adds an event. Clinical findings and treatment instructions are unavailable. |
| **Follow-up Monitoring** | Overlapping due/overdue, acceptance/receipt, counter-referral/acknowledgement, missed-appointment, incomplete, inactivity and escalation queues; configurable thresholds and predefined fictional attempt outcomes. No reminders are sent. |
| **Referral Analytics** | Explicit denominators, event milestone and time-in-stage calculations, completion delays, rejection, reason/service/geography, receiving workload, inactivity and network review signals, with interactive filters. |
| **Simulation Laboratory** | Compare unavailable receiver, hypothetical site, increased demand, gained fictional service, bottleneck penalty or increased workload against a recomputed synthetic baseline; scenarios never mutate saved referrals. |

### Try the main workflow

1. Open **Create Referral**, choose a fictional reason, a matching destination, and `Permission simulated`, then choose **Review referral**. Save a draft or **Submit simulation**. Missing permission permits a draft but not submission. Never enter real identifying or clinical information.
2. Open **Facility Matching** to change the requested service or optional extra fictional tag, inspect ranking/exclusions and use a candidate. **Inspect in GEOACCESS** focuses that fictional facility; **Return to REFLEX** returns to the prior workspace and preserves an unsaved form in tab memory until reload.
3. From **Referral Tracking**, select the example and advance its permitted statuses. The local timeline records simulated role labels and event times. To exercise counter-referral, advance to received/service-completed or reject from awaiting acceptance, then open **Record counter-referral**. Record the administrative details, acknowledge locally, return to tracking and close if desired.
4. In **Follow-up Monitoring**, select a queue, mark an example completed or log a predefined simulated attempt. In **Referral Analytics**, select a delay bin, service, geography or current status; clear the shared filters when finished.
5. In **Referral Network**, select a node or connection, or switch to **Geographic**. In **Simulation Laboratory**, run any scenario and compare its modelled baseline and result. Reset local examples only if you intend to discard local changes.

**Geographic integration:** REFLEX reuses GEOACCESS fictional facilities, LGA index, Haversine calculation and published geographic context. State/FCT is shared; REFLEX LGA filters apply to the origin, while GEOACCESS LGA selection remains local. Only a fictional facility ID is passed during a map handoff; no referral or patient reference is passed to the map. GEOACCESS spatial scenarios do not consume REFLEX referrals or model destination capacity. The dark styling is scoped to REFLEX; the shared shell, Stage 1 and GEOACCESS have not been redesigned.

## Methods and interpretations

- **Matching.** A different facility with the requested fictional service tag is required; an optional extra tag is also an eligibility filter, not points. Index = service 45 + tag breadth up to 15 + same state/FCT 10 + Haversine proximity up to 20 falling to zero at 500 km + five populated fields up to 10, less hypothetical scenario penalties. Priority/urgency is displayed but **not scored**. Readiness, staffing, beds, medicines, equipment and actual availability are unknown. The index is not validated clinical suitability, quality or a probability; straight-line distance is neither a road route nor travel time.
- **Filters and metrics.** State/FCT and LGA select the origin; facility and type select either endpoint; service and status refer to the requested category and current status; dates refer to creation. Drafts appear in general counts but not submitted network or monitoring queues. Completion = ever completed / ever submitted. Rejection = ever rejected / ever submitted. Counter-referral completion = counter recorded among ever completed / ever completed. Follow-up completion = completed / (pending + completed), excluding not-required and drafts. A zero denominator is unavailable. Mean processing is submission-to-service-completion for valid event pairs. Stage durations average completed intervals between consecutive status events and exclude current open intervals and auxiliary follow-up events. The event milestone bars count ever-reached stages, while clicking a bar filters by current status.
- **Monitoring.** Overdue is a pending follow-up before the browser-local date; upcoming includes today through the configured window. Inactivity is no status change for a threshold on an open pathway, not proof of no contact or patient loss. The missed-appointment flag requires pending follow-up and the latest explicitly logged fictional attempt outcome to be `missed-appointment`; a later rebooking changes that signal. Queues overlap. Review thresholds are whole numbers 1–90 days, with escalation at least the inactivity threshold.
- **Network.** Submitted examples with valid different endpoints create unique directed edges. Degree counts distinct neighbours; unweighted directed Brandes betweenness is normalised by `(n − 1)(n − 2)`; density = unique directed edges / `n(n − 1)`; weak components ignore direction. Top-receiver share is the largest inbound count / network volume. Low connectivity means in-degree + out-degree ≤ 1. Only facilities in at least one submitted valid edge appear as nodes, so catalog facilities with zero edges are not shown. Volume affects display, not shortest paths. Signals are not evidence of actual bottlenecks.
- **Simulation.** Every submitted example is reassigned to its highest-ranked compatible fictional candidate for the baseline; this is not the recorded destination. The unavailable scenario removes a receiving candidate only; a bottleneck subtracts an arbitrary 25 points; demand scales all weights and workload scales one receiving destination. Fractional weights are not new referrals and do not infer rerouting due to capacity. A new site's coordinates are checked against simplified 2022 state/FCT boundaries. The graph is unweighted; mean distance is weighted. These are comparison heuristics, not forecasts or evidence of access.
- **Identification.** The QR generated by pinned `qrcode.react` 4.2.0 encodes only the synthetic referral ID. It is not a credential, secure token, shared-record link or authorisation. The local text summary omits administrative notes and is not a real referral or communication.

## Data provenance and uncertainty

- **SYNTHETIC / SIMULATED:** all 111 facility names, categories, locations, service tags and 222 initial referral examples and events are fictional. Local edits, role labels, permissions, acknowledgement, follow-up and scenarios are simulated. Time-dependent seed counts vary with first-open date and subsequent edits. No real patient information should be entered.
- **PUBLISHED, NOT INDEPENDENTLY VERIFIED:** Nigeria state/FCT and 774 LGA boundaries from GRID3 via geoBoundaries represent 2022 (CC BY 4.0); 2,924 displayed GRID3 settlements are a systematic sample, not a complete representative inventory (2021 release, CC BY 4.0). Boundaries and spatial joins are simplified/contextual.
- **ESTIMATED:** WorldPop/CIESIN 2020 unconstrained population counts/density are models, not a current census or measured access. Spatial and straight-line distance outputs are estimates, not observed routes.
- **UNVERIFIED / INSPECTION ONLY:** GRID3 operational ward v4.0 (2026, CC BY-SA 4.0) provides 9,306 display polygons; 29 geometries are omitted, 59 repaired and provider-reported defects remain. Ward selection is not a ward-level analysis. See `README.md`, `public/data/geoaccess/manifest.json`, ward attribution and the Data Observatory for detailed sources, licences and caveats.
- NHFR, road networks, live bed/staff/medicine/equipment status, clinical systems, FHIR, NCDC/MSDAT/DHS feeds, notifications and backend event storage are **not connected**. No real facility/service availability is verified.

## Verification performed

On 12 November 2026 the refreshed project was built and tested using Node 22.23.5, npm 10.8.2 and Playwright Chromium with software WebGL. Commands can be run from the source root:

| Command | Coverage / result |
| --- | --- |
| `npm run typecheck` | Passed TypeScript. |
| `npm run test:data` | Passed 37 administrative areas and 185 explicitly synthetic Stage 1 markers. |
| `npm run test:geo` | Passed 774 LGAs, 9,306 display wards, 2,924 sampled settlements, 18,756 population cells, 111 fictional facilities and 160 checksums. |
| `npm run test:reflex` | Passed seed, simulated permission, v1 compatibility/integrity, lifecycle, counter-referral/acknowledgement, follow-up signals/attempts, capability matching, identity summary, stage timings, directed graph and all six non-mutating scenarios. |
| `npm run build` | Passed the production build. |
| `npm run test:e2e` | Passed Stage 1 navigation, preferences, maps, geography and mobile regression. |
| `npm run test:geo:e2e` | Passed GEOACCESS eight tabs, FCT/LGA, ward, maps, data export, spatial calculations, scenarios and mobile. |
| `npm run test:reflex:e2e` | Passed all nine workspaces, shared filters including facility type, exclusion explanation, creation/edit/submit, GEOACCESS round trip, QR/summary download, full lifecycle/rejection/acknowledgement, graph, monitoring attempts, analytics, six scenarios, 320/390/768 px layouts, legacy v1 snapshot, corrupt/blocked storage and cross-tab updates. |
| `npm run test:offline` | Passed production shell, precached MapLibre worker and geographic hit-testing/deck.gl; visited REFLEX/GEOACCESS assets and local referral updates reopen offline; uncached data explicitly reports unavailable. |
| `npm audit` | Zero vulnerabilities reported on the test date; advisories change. |

The synthetic-ID QR was separately decoded with OpenCV and matched the displayed ID. One offline run crashed its browser target while three browser suites ran concurrently under sandbox load; it passed when run separately. React StrictMode may log aborted duplicate development requests. These checks are not a formal accessibility certification, security assessment, clinical validation or testing on every browser/device. The graph layout overlap check covers the seeded national view, not every dataset. Recharts 2.x is on an inactive branch and should be migrated to a supported release with chart regression testing.

## Architecture and operational limits

- `src/reflex/Reflex.tsx`, `components/`, `reflex.css` and `reflex-dark.css`: nine workspaces and REFLEX-scoped visual treatment. `src/reflex/engine/` contains lifecycle, identity, matching, analytics, network and simulation algorithms. `src/reflex/data/` contains the seed, validated local store, in-memory session and future-only contracts.
- React 19, TypeScript, Vite, D3, Recharts, MapLibre 6.18.0, deck.gl, Turf and qrcode.react support the interface. The pinned MapLibre ES-module worker is explicitly configured and precached; revalidate packaging, WebGL 2 and offline behaviour on upgrade. FastAPI provides only an optional `/health` scaffold, not a referral backend or FHIR server.
- Local records use `localStorage` key `sentra-reflex-synthetic-v1`: unencrypted, unauthenticated, browser/profile/origin-specific and clearable. Cross-tab writes are last-writer-wins, with no concurrency resolution. Malformed data are retained until explicit reset; blocked storage is labelled memory-only. Limited email/phone-pattern detection cannot guarantee privacy.
- Additive optional v1 fields preserve older snapshots. Missing simulated permission remains **not recorded**; existing event history is not invented. Older drafts require a deliberate simulated-permission selection before submission. A missing additional capability is shown as not recorded; backward-compatible matching and simulation apply no extra tag filter in that case, which does not establish what was required. Simulated permission is not real consent; roles and acknowledgements are not authenticated. The local history is not a protected audit trail.
- The ID-only QR and text summary are **not secure sharing**, and there is no bulk import/export, multi-user collaboration, transmission, live alerts, real consent handling, operational authorisation, encrypted store or real-time availability. Clinical narratives, findings and ongoing treatment instructions are unavailable. All status actions are local simulation only.
- Static public datasets are cached on first visit. Visit each required geography/layer while online before offline use; an old cache is not fresh data. Do not use offline storage for patient information.

## Stage 4 readiness and approval gate

Stage 3 is ready for **prototype review**, not deployment. Stage 4 has not begun. Before considering further implementation or real-world use, obtain your explicit approval and establish an authorised governance/consent model; threat modelling, authentication, granular roles, encryption, retention and tamper-resistant audit; verified identifiers and sourced, timestamped facility/availability data; durable concurrent storage and integration contracts; documented FHIR mapping/validation if required; appropriate road/accessibility data; uncertainty/fairness analysis; and independent clinical, public-health, accessibility and security review. None is implied to exist now.
