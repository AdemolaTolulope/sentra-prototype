# senTRA Stage 3.5 — platform architecture and workstation handover

> Historical snapshot: this document describes Stage 3.5 at its review date. For the current project summary, see the [overview](README.md) and [technical reference](docs/PROJECT-REFERENCE.md); for MAMA-GUARD, see [HANDOVER-STAGE4.md](HANDOVER-STAGE4.md).

**Status:** prototype complete for review, not an operational healthcare platform.  
**Review date:** 12 November 2026.  
**Attribution:** student-led project representing the Department of Biochemistry, Faculty of Science, Adekunle Ajasin University (AAUA), Akungba-Akoko, Ondo State, Nigeria. This representation does not imply university endorsement or partnership.

> **Do not enter real patient or professional information.** There is no genuine authentication, server-side authorisation, clinical AI, secure patient store, consent service, telemedicine provider, incident feed, dispatch service or clinical validation. Workspace selection is navigation, not identity or permission. Do not use this prototype for clinical, emergency, operational planning or resource-allocation decisions.

## 1. What is delivered

Stage 3.5 extends the existing React application rather than replacing it. Stage 1, the eight GEOACCESS views and the nine REFLEX views remain reachable. MAMA-GUARD and the other future module pages remain placeholders; Stage 4 has **not** begun.

| Surface | Hash route | What works in this prototype | Boundary |
| --- | --- | --- | --- |
| Community & Patient | `#/community` | Workspace navigation to the fixed report, geography, REFLEX and service boundaries | Not a patient account |
| Clinical Intelligence | `#/clinical` | Professional pathway, synthetic referral and report links | No clinician identity, records or privileges |
| Operations & Intelligence | `#/operations` | Prominent 3D/2D Nigeria environment, geography and synthetic facility selection, source controls and ID-only GEOACCESS handoff | No live availability or operational intelligence |
| senTRA AI | `#/sentra-ai` | Locked gateway and two fixed, non-clinical workflow scripts; emergency example interrupts ordinary flow | No real text/voice input, consultation, retrieval or AI |
| Account & Access | `#/account` | Local language preference and clear role/consent boundaries | Sign-in, registration, recovery and real consent unavailable |
| Professional Pathway | `#/professional-onboarding` | Editable **synthetic-only**, memory-only form and simulated awaiting-review state | No application, upload, credential check or verified professional |
| Care & Reports | `#/care-reports` | Fixed synthetic report, local text download and module links | No patient report, sharing, email or consent recording |
| Telemedicine | `#/telemedicine` | Patient/professional workflow boundaries | No directory, clinician, appointment, call or notification |
| Emergency Health | `#/emergency` | Static civilian-health/humanitarian process guide and links to demonstration modules | No incident data, inventory, teams, deployment, dispatch or live feed |
| GEOACCESS / REFLEX | `#/geoaccess`, `#/reflex` | Existing geographic analyses and fictional referral lifecycle | Synthetic health data; not a real registry or referral service |

The shared shell uses the requested dark workstation palette. GEOACCESS and REFLEX have scoped dark treatments; Stage 1 analytical content retains its established light treatment for chart readability. All existing hash routes are preserved.

### Screenshots

Final production-build captures are in `docs/previews/stage3.5/final/`:

- [Community](docs/previews/stage3.5/final/community.png) · [Clinical](docs/previews/stage3.5/final/clinical.png) · [Operations 3D](docs/previews/stage3.5/final/operations.png)
- [AI safety boundary](docs/previews/stage3.5/final/sentra-ai.png) · [Account](docs/previews/stage3.5/final/account.png) · [Professional onboarding](docs/previews/stage3.5/final/professional-onboarding.png)
- [Care & reports](docs/previews/stage3.5/final/care-reports.png) · [Telemedicine](docs/previews/stage3.5/final/telemedicine.png) · [Emergency health](docs/previews/stage3.5/final/emergency.png)
- [GEOACCESS](docs/previews/stage3.5/final/geoaccess.png) · [REFLEX](docs/previews/stage3.5/final/reflex.png) · [Community mobile](docs/previews/stage3.5/final/community-mobile.png) · [Operations mobile](docs/previews/stage3.5/final/operations-mobile.png)

Screenshots are examples, not evidence of live services or verified data. Recreate them with `SENTRA_URL=http://127.0.0.1:5173/ node scripts/capture-stage35.mjs` after starting a production preview.

## 2. Architecture and integration

```text
React 19 / TypeScript / Vite browser prototype
  ├─ shared shell, hash routes and non-sensitive WorkspaceContext preferences
  ├─ community / clinical / operations workspaces
  ├─ locked AI, account, professional, report, telemedicine and emergency previews
  ├─ GEOACCESS: MapLibre + deck.gl + local public/synthetic geographic adapters
  ├─ REFLEX: synthetic local referral records, calculations and in-memory handoff
  └─ service worker: static application assets + visited public geographic derivatives

TypeScript and Python service contracts ── no configured providers ──┐
FastAPI scaffold: /health only as a business endpoint               │
Future, separately governed services: identity, permissions, consent, │
AI/safety/evidence/speech, secure records, FHIR, scheduling, video,  │
notifications, verified geography and civilian coordination         ┘
```

Key source locations:

- `src/App.tsx`, `src/services/route.ts`, `src/components/`: preserved shell and hash routing; navigation is not an authorisation boundary.
- `src/platform/`: workstation surfaces and shared primitives; `src/platform/services/` contains provider-independent types, deliberately unconfigured adapters and fixed scripts.
- `src/geoaccess/`: unchanged analytical engine and data adapters, a shared MapLibre/deck.gl map, plus scoped dark styling. Operations reuses this map rather than introducing a second mapping framework.
- `src/reflex/`: existing synthetic referral engine, validated local store and in-memory SPA handoff. Only a fictional facility ID is passed from Operations to GEOACCESS; no patient data is passed.
- `backend/app/contracts.py`: design-only Python schemas and protocols. `backend/app/main.py` has the scaffold `/health` endpoint and FastAPI's documentation/metadata routes; no identity, data or AI API exists.
- `src/types/domain.ts` and `src/platform/services/reports.ts`: FHIR R4-shaped interfaces only. No FHIR validation, resource mapping, server or certification is supplied. PostgreSQL/PostGIS and FastAPI are future stack directions, not connected services.

### Identity, consent and safety

`unconfiguredIdentity`, permissions, consent, AI, report, appointment, video, notification and emergency adapters fail closed or report not recorded. The client-side checks are display/design aids; only a genuine backend can validate sessions, enforce least privilege, bind permissions to resources and record auditable consent. The AI turn contract checks a genuine-session-shaped response and permission before invoking safety; **emergency, uncertain or failed safety checks do not continue ordinary intake**. Tests use mocks and are not a clinical validation. No real turn is accepted by the UI.

The fixed AI examples are predetermined English copy, not generated responses. The emergency example cannot contact help. English, Yoruba, Hausa, Igbo and Nigerian Pidgin can be selected as a local preference; no translation, transcription, speech synthesis or language validation is implemented. The speech interface anticipates a text fallback only after an approved service is configured.

The professional form covers category, specialty, qualifications, institution, registration number, contact and optional LinkedIn. Doctors and dentists show an MDCN route; other categories show their relevant regulatory route or one to be determined. These are proposed review paths, not evidence of a registry integration. The lifecycle displays submitted, awaiting review, in progress, verified, rejected and suspended; the only interactive result is a clearly simulated awaiting-review preview. A number or profile link does not verify anyone, and upload is disabled.

The fixed report is not an assessment and has no invented citations. Its download is a constant synthetic text file. Email and clinician-sharing controls are disabled; no consent is recorded and nothing is transmitted. Future sharing requires recipient- and purpose-specific consent, server-side authorisation and an auditable service.

## 3. Geographic encoding and provenance

| Class | Source / use | Scope and limitation |
| --- | --- | --- |
| **UNVERIFIED** | GRID3 / geoBoundaries 2022 administrative polygons, [source](https://data.humdata.org/dataset/geoboundaries-admin-boundaries-for-nigeria), CC BY 4.0 | 36 states plus FCT and 774 simplified LGAs; published, not independently verified. |
| **ESTIMATED** | [WorldPop 2020 unconstrained model](https://hub.worldpop.org/geodata/summary?id=42943), CC BY 4.0 | Modeled population, not a current census. Approximately 216,798,661 source population and 216,602,569 assigned to ADM1; boundary assignment and aggregation are approximate. |
| **UNVERIFIED** | [GRID3 settlement names](https://data.grid3.org/datasets/GRID3::grid3-nga-settlement-names/about), CC BY 4.0 | 2,924 systematically sampled points from the 2021 release; a partial, non-representative subset. |
| **UNVERIFIED** | [GRID3 operational wards v4.0](https://data.grid3.org/datasets/GRID3::grid3-nga-operational-wards-v4-0/about), CC BY-SA 4.0 | GEOACCESS 2D inspection only: 9,306 renderable of 9,335 source features; 29 omitted and 59 repaired. Source defects and boundary mismatches remain. |
| **SYNTHETIC** | 111 facility records and the initial 222 REFLEX records | Names, positions, services, referrals and status histories are fictional. No real service readiness is known. |
| **SIMULATED** | Radius/access comparisons, referral matching and scenarios | Straight-line great-circle distance is not road distance or travel time. Results are not evidence of actual access, deprivation or clinical capacity. |

Operations uses **exaggerated** 3D administrative polygon height of 60 m per modeled person/km², capped at 150 km, solely to make the density encoding legible at national scale. It is not terrain, true altitude, facility capacity or healthcare access. Its facility markers are fictional; settlement markers are an unverified sample. Two-dimensional 25 km radii and gap candidates are fictional comparisons. The full GEOACCESS view retains its original 3 m/person/km² and 35 km display cap, with wards, radii and other analytical overlays in 2D. See `public/data/geoaccess/manifest.json`, the Data Observatory and `README.md` for source URLs, licences, checksums and detailed methods.

Unavailable overlays are not zero: there is no verified facility registry, road-routing network, outbreak or incident feed, bed/staff/medicine stock, appointment availability, response team or deployment data. A registered facility, if integrated later, would still not prove current operational availability.

## 4. Storage, privacy and offline limits

- Language, geography, display preferences and sample-alert review state are saved in local IndexedDB when available. They are not an account.
- The professional form is memory-only and clears on leaving/reloading. The report download contains only fixed synthetic text. The UI does not prevent every accidental entry of real information: **do not enter it**.
- REFLEX retains its existing `sentra-reflex-synthetic-v1` localStorage store. It is unencrypted, unauthenticated, origin-specific and last-writer-wins. Simulated consent, roles, QR and local event history are not real consent, identity, secure sharing or a protected audit trail. Pattern checks cannot guarantee privacy.
- A production service worker precaches the application shell/chunks and caches visited public geographic assets. It does not cache future API responses or patient records. An unvisited geography can be unavailable offline; cached data is not necessarily current. The AI remains locked offline.
- No privacy compliance, security certification, accessibility certification or clinical validation is claimed. Host allowlists, transport security, secure storage, audit, retention and threat modelling are not production-ready.

## 5. External integrations needed before real use

| Integration / governance | Current status and minimum future requirement |
| --- | --- |
| Identity and permissions | None. Configure genuine identity, session validation, server-side resource authorisation, least privilege and audit. |
| Professional verification | None. Establish authorised independent regulator checks, review and status management; do not infer verification from an entered number. |
| AI, safety and evidence | None. Approve providers, safety-first escalation and failure handling, reviewed evidence with traceable citations, clinical oversight and testing. No independent diagnosis or fabricated citations. |
| Language and speech | None. Evaluate language quality, transcription, privacy and accessibility; retain text fallback. |
| Reports, consent and interoperability | None. Secure patient data and purpose-specific consent, retention/revocation and validated FHIR R4 profiles where appropriate. |
| Telemedicine and notifications | None. Verified clinicians, actual scheduling/video providers, consent, secure exchange and opt-in communications. |
| Real geography and resources | None. Authorised, timestamped facility and operational-readiness sources, transport/road data, provenance, uncertainty and update processes. |
| Civilian emergency coordination | None. Verified incident intake, authorised roles, resource data, secure audit and human oversight; no deployment capability exists here. |

## 6. Reproduce and verify

Requirements: Node.js 22 or newer, npm, a WebGL 2-capable browser and Playwright Chromium for browser tests. No API key or backend is needed to run the prototype.

```bash
cd sentra
npm ci
npm run dev                 # development preview
# or:
npm run build
npm run preview             # production preview and service-worker tests
```

Use the URL printed by Vite. For a different port set, for example, `SENTRA_URL=http://127.0.0.1:5177/` before browser tests. Install the browser if needed with `npx playwright install chromium`. Run browser suites **serially** on constrained machines.

| Check performed on 12 November 2026 | Result |
| --- | --- |
| Node 22.23.5, npm 10.8.2; `npm run typecheck`, `npm run build` | Passed |
| `npm run test:data` | Passed 37 administrative areas and 185 Stage 1 synthetic markers |
| `npm run test:geo` | Passed 774 LGAs, 9,306 display wards, 2,924 settlements, 18,756 population cells, 111 fictional facilities and 160 checksums |
| `npm run test:reflex` | Passed synthetic seeds, storage compatibility, lifecycle, matching, graph, monitoring and simulations |
| `npm run test:platform` | Passed fail-closed contracts, emergency interruption, language, professional, report and unconfigured service checks |
| `npm run test:e2e`, `npm run test:geo:e2e`, `npm run test:reflex:e2e` | Passed existing Stage 1, GEOACCESS and REFLEX desktop/mobile regressions |
| `npm run test:platform:e2e` | Passed new routes, disabled boundaries, memory-only draft, synthetic download, map/ID handoff and 320/390/768 px checks |
| `npm run test:offline`, `npm run test:platform:offline` | Passed production worker, visited assets and explicit uncached-data errors; locked AI remained locked offline |
| `npm audit --audit-level=low` | Zero vulnerabilities reported on the review date; advisories change |
| Python scaffold import / `/health` function / schema compilation | Passed; no operational backend was started |

Browser tests used Chromium with software WebGL; they are not an exhaustive accessibility, device, security or clinical assessment. During clean-archive verification, an initial build was killed by the 2 GB sandbox's out-of-memory limit. After stopping unused development previews, `NODE_OPTIONS=--max-old-space-size=640 npm run build` passed; use that option on similarly constrained systems. Recharts 2.x is on an inactive branch; a future supported-version upgrade needs chart regression testing.

## 7. Next-stage recommendation

Review and approve this Stage 3.5 prototype first. Before any real patient workflow, prioritise a governed identity/consent and secure backend foundation, source verification, clinical safety design and independent privacy/security/accessibility review. Only after that review and explicit approval should the next product stage be planned. **MAMA-GUARD / Stage 4 has not been started.**
