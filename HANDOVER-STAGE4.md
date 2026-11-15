# senTRA Stage 4 — MAMA-GUARD handover

**Status:** synthetic prototype complete for review; not an operational maternal-health service.  
**Review date:** 12 November 2026.  
**Project:** student-led innovation representing the Department of Biochemistry, Faculty of Science, Adekunle Ajasin University (AAUA), Akungba-Akoko, Ondo State, Nigeria, for the USPF Changemaker Challenge 2026 — Healthcare Sector. Representation does not imply university endorsement or a partnership.

> **Never enter real patient or professional information.** There is no genuine identity, server-side authorisation, secure clinical database, real consent service, live AI, clinical validation, real referral transmission or verified facility availability. Roles, consent, records, events and referrals in this prototype are fictional demonstrations. Do not use them to diagnose, arrange care, choose an emergency destination, or make public-health or resource-allocation decisions.

## 1. What is delivered

MAMA-GUARD extends the existing React/Vite workstation at `#/mama-guard`; Stage 1, GEOACCESS, REFLEX and the Stage 3.5 workspaces remain available. Shared geography, existing fictional facility data, the GEOACCESS map, REFLEX's referral lifecycle and the existing fail-closed service interfaces are reused rather than duplicated.

| Workspace | Demonstrated behaviour | Important boundary |
| --- | --- | --- |
| **Command Centre** | Geography, LGA, stage, follow-up and referral filters; fictional register and cohort counts | Values describe the filtered examples, not actual Nigerian maternal health. Categories can overlap. |
| **Care Profiles** | Create a generated synthetic reference; choose coded coordination, patient and clinician example categories; inspect session history | No names, contact details, observations or real clinical narratives are collected by MAMA-GUARD. Role changes are not authentication. |
| **ANC Timeline** | Add individual fictional dates and update scheduled, missed, completed or cancelled status | Past-date scheduled and explicitly missed are different; no booking or reminder is sent. |
| **Safety & Escalation** | Immediate static maternal/newborn warning-sign education; safety remains accessible if the geographic files fail to load | No triage, symptom assessment or diagnosis. Wording has not received independent clinical review and the list is not exhaustive. |
| **Delivery & Facilities** | Reused GEOACCESS map, provenance details, fictional facility preference and straight-line comparison | All facility names, positions and service tags are fictional. Availability, maternity/emergency-obstetric/newborn readiness, equipment and staffing are unknown. |
| **Maternal Referrals** | Prefill the existing REFLEX form, then inspect linked status, counter-referral and follow-up examples | No facility or person is contacted; an unsaved REFLEX form is replaced only after confirmation. |
| **Postnatal & Newborn** | Link fictional newborn references and individually dated follow-up/immunisation-review examples | A review marked complete is not a recorded vaccine dose. No universal schedule, eligibility or treatment is inferred. |
| **Analytics** | Filtered sample counts with explicit profile or appointment denominators | No real population rates, risk scores, mortality figures, predictions or facility-performance statistics. |
| **Trust & Sources** | Provenance, source links/review status, simulated role explanation, local audit-style events and a fail-closed real-access check | No verified identity, consent, secure audit or configured AI is claimed. This page remains usable when sample initialization fails. |

The emergency banner appears before the workspace tabs. It advises seeking immediate emergency help for severe bleeding, seizures, severe breathing difficulty or unconsciousness during pregnancy/after birth, and for a newborn who is not breathing, has seizures or is unresponsive. It does not point to fictional facilities. For other worrying signs, the safety workspace advises urgent professional assessment. **This is static educational wording, not a clinical assessment; it requires qualified local review.**

## 2. Try the synthetic continuity flow

1. Open MAMA-GUARD, choose a state/FCT and inspect the example cohort. Fresh initialization creates 74 fictional profiles, two per state/FCT. With an untouched REFLEX seed, 19 profiles link to pre-existing fictional maternal referrals. These are constructed examples, not population samples; counts change when filters or local REFLEX examples change.
2. As the **simulated coordinator**, choose **New synthetic profile**, select a fictional geography, origin and stage, and save. Only preset categories and generated IDs are used. Choose an existing example before switching to the patient preview.
3. Switch to **patient · simulated** to edit that one subject's preset patient example and simulated information-sharing choice. Switch to **clinician · simulated** for its preset clinician category. Neither selection proves identity or professional status; the operations preview hides individual rows but is not a security boundary.
4. In **ANC Timeline**, add an example date. A scheduled date before today is shown as past-dated, but becomes *missed* only through an explicit simulated status change. A future example cannot be marked completed or missed. In **Postnatal & Newborn**, link a fictional newborn before adding a newborn or immunisation-review example. The dates are individually chosen, not clinical schedule recommendations.
5. In **Delivery & Facilities**, inspect a fictional maternal-tag example or choose a fictional preference. The comparison is sorted by great-circle distance from the fictional origin, excludes that origin and is not a suitability recommendation. A tag is not proof of current services.
6. To demonstrate a handoff, set **permission simulated** in the patient preview, return to coordinator or clinician, and choose **Prepare synthetic REFLEX form**. Review and submit the example in REFLEX; use its existing tracking, counter-referral acknowledgement and follow-up views, then return to MAMA-GUARD. An existing unsaved REFLEX form prompts before replacement.
7. **Reset MAMA-GUARD examples** resets only the in-memory maternal sample after confirmation. It does not delete REFLEX's local records. Reloading also clears maternal changes.

The prefilled REFLEX form contains the generated synthetic reference, fictional origin, optional fictional destination, maternal-care administrative category, simulated permission and, when available, a scheduled example follow-up date. Its clinical context is the fixed text `No clinical summary recorded` and notes start empty. No maternal patient/clinician category or clinical narrative is copied and nothing is transmitted. The existing REFLEX form has editable free-text fields: its safeguards cannot prevent every accidental entry, so **never enter real information**.

## 3. Data, consent and offline boundaries

- **MAMA-GUARD:** profiles, newborn references, appointments, simulated roles, local consent choices and up to 500 audit-style events live in memory in this browser tab. They survive SPA navigation but disappear on reload. Local event labels are not a tamper-proof or authenticated audit log.
- **REFLEX:** its existing `sentra-reflex-synthetic-v1` localStorage store can persist fictional referrals, follow-up and counter-referrals across reloads. It is unauthenticated, unencrypted, origin-specific and last-writer-wins. A new MAMA-GUARD profile can disappear while a saved REFLEX reference persists and becomes unlinked. Original deterministic REFLEX seeds alone are used for initial sample links; an orphaned user-created reference does not manufacture a maternal profile after reload.
- **Simulated consent:** required before the demonstrated handoff; it is not real consent. Changing or withdrawing that local choice does not retroactively revoke, change or delete a previously saved REFLEX example. A real deployment needs purpose- and recipient-specific consent, withdrawal, server enforcement and audit.
- **Errors:** an unreadable REFLEX store is preserved rather than silently overwritten, and unavailable referral data are not counted as 'no referral'. When browser storage is blocked, REFLEX warns that examples may remain only in memory. Safety and source/access boundaries remain available if the geographic initialization fails.
- **Preferences:** shared geography, display and language preferences may be stored in local IndexedDB; a language choice is not translation. No real speech, translation, patient messaging or notification service exists.
- **Offline:** after a successful online visit to the production build, the service worker precaches the application shell, emitted assets and MapLibre worker. Previously visited public GEOACCESS data can reopen offline; unvisited geographic files report unavailable. Maternal examples still clear on reload and safety remains visible. The worker does not cache API endpoints or patient records. Offline installation is not guaranteed before a first successful online load, and public cached data are not necessarily current.

## 4. Geography, evidence and provenance

The facility layer contains **111 fictional facilities**, 19 with a fictional `Maternal care` tag. All operational availability is unknown and no real maternity, emergency-obstetric or newborn-service registry is connected. The map can filter those examples by shared geography; comparison candidates use existing REFLEX matching and GEOACCESS Haversine distance from the fictional origin. Straight-line distance is neither a road route nor travel time. GEOACCESS also displays published boundaries, sampled settlements and WorldPop 2020 modeled population; those sources are contextual, not evidence of service availability. In the full GEOACCESS map, 3D polygon height exaggerates modeled population density at 3 m per person/km², capped at 35 km; the separate Operations workspace uses 60 m per person/km², capped at 150 km. Neither shows terrain, capacity or access.

| Provenance class | Data | Limitation |
| --- | --- | --- |
| **Synthetic / simulated** | Maternal/newborn profiles, facilities, service tags, referrals, roles, permissions, alerts and computed demonstrations | Entirely fictional; not real observations, consent, communications or readiness. |
| **Unverified published context** | [GRID3 / geoBoundaries administrative boundaries](https://data.humdata.org/dataset/geoboundaries-admin-boundaries-for-nigeria), [GRID3 settlement names](https://data.grid3.org/datasets/GRID3::grid3-nga-settlement-names/about), [GRID3 operational wards](https://data.grid3.org/datasets/GRID3::grid3-nga-operational-wards-v4-0/about) | Published sources are not independently verified by the project; 2,924 settlements are a partial sample. Of 9,335 ward features, 9,306 render and 29 are omitted; 59 were repaired. |
| **Estimated / historical** | [WorldPop 2020 modeled population](https://hub.worldpop.org/geodata/summary?id=42943) | Modeled counts are not a current census; spatial assignment and aggregation are approximate. |
| **Unknown / not connected** | Facility availability, clinical readiness, beds, staffing, medicine, road travel times, current registries | No inference can be drawn from a fictional point or tag. |

Educational sources were checked for relevance on 12 November 2026; **application wording, local suitability and rules have not been clinically reviewed**, and sources do not endorse senTRA:

1. WHO/UNFPA/World Bank/UNICEF, [*Pregnancy, childbirth, postpartum and newborn care: a guide for essential practice*, third edition](https://iris.who.int/handle/10665/249580), 2015 — skilled-attendant guidance intended for local adaptation.
2. WHO, [*Newborn health*](https://www.who.int/europe/news-room/fact-sheets/item/newborn-health), 30 August 2021 — newborn danger-sign context.
3. WHO, [quality care for women and newborns in the first weeks after childbirth](https://www.who.int/news/item/30-03-2022-who-urges-quality-care-for-women-and-newborns-in-critical-first-weeks-after-childbirth), 30 March 2022 — postnatal continuity context.
4. WHO, [tools to adapt antenatal care recommendations](https://www.who.int/news/item/22-06-2020-new-tools-to-help-ensure-a-positive-pregnancy-experience-for-women), 22 June 2020 — local adaptation is needed.
5. UNICEF Nigeria, [safe pregnancy education](https://www.unicef.org/nigeria/safe-and-health-pregnancy), publication date not stated — warning signs and care context; its visit counts are not imported as universal rules.
6. Nigeria Federal Ministry of Health, [*National Guidelines on Self-Care for Sexual, Reproductive and Maternal Health*](https://platform.who.int/docs/default-source/mca-documents/srh-policy-documents/nga-national_guidelines_on_self-care_for_sexual-reproductive_and_maternal_health_2020.pdf), November 2020, WHO-hosted archival copy — national policy context only; current local applicability must be checked.

Detailed dataset licences, methods, checksums and known spatial limitations remain in [README.md](README.md), the Data Observatory and `public/data/geoaccess/manifest.json`.

## 5. Architecture and integration status

- `src/mamaguard/types.ts`, `engine.ts`: fictional structures, validation, cohort counts, seed generation, exact-reference REFLEX links and minimum handoff construction.
- `src/mamaguard/data/MamaSession.tsx`: memory-only state, simulated roles, selected-subject restriction and capped local event history. These checks do not secure browser data.
- `src/mamaguard/MamaGuard.tsx`, `components/`, `mama-guard.css`: route shell, nine workspaces, accessible tab navigation and responsive dark styling.
- `src/reflex/`: existing synthetic form/store and referral lifecycle. `ReflexSessionProvider` carries an unsaved form and return context across SPA navigation. `src/geoaccess/` supplies the existing map, geographic adapters and distance calculations.
- `src/platform/services/identity.ts` and `ai.ts`: unconfigured contracts that fail closed. No real authentication, authorisation, patient record, consent, evidence retrieval, model, translation or speech service is connected. The backend scaffold still exposes only `/health` beyond FastAPI metadata/docs.
- `scripts/test-mamaguard.mjs`, `scripts/mamaguard-e2e.mjs`, `scripts/mamaguard-offline.mjs`: Stage 4 core, browser and production-offline checks. `scripts/capture-stage4.mjs` reproduces the screenshots.

## 6. Reproduce and verify

Requirements: Node.js 22 LTS or newer, npm, a WebGL 2-capable browser and Playwright Chromium for browser checks. No credentials, backend or database are needed for the prototype.

```bash
cd sentra
npm ci
npm run dev
# Production build and preview, needed for offline tests:
NODE_OPTIONS=--max-old-space-size=768 npm run build
npm run preview
# In another terminal, after installing Chromium with npx playwright install chromium:
npm run typecheck
npm run test:data && npm run test:geo && npm run test:reflex
npm run test:platform && npm run test:mamaguard
npm run test:e2e && npm run test:geo:e2e && npm run test:reflex:e2e
npm run test:platform:e2e && npm run test:mamaguard:e2e
npm run test:offline && npm run test:platform:offline && npm run test:mamaguard:offline
npm audit --audit-level=low
```

For a preview on another port set, for example, `SENTRA_URL=http://127.0.0.1:5181/`. Run browser suites serially on constrained machines. A 640 MB V8 heap cap failed during one Stage 4 build; stopping unused development previews and using 768 MB succeeded in the 2 GB sandbox. Memory requirements vary by environment.

| Check performed on 12 November 2026 | Result |
| --- | --- |
| Node 22.23.5, npm 10.8.2; strict typecheck and production build | Passed |
| Stage 1, GEOACCESS, REFLEX, platform and MAMA-GUARD core suites | Passed; included source checksums, role/chronology/linkage rules and fail-closed adapters |
| Stage 1, GEOACCESS, REFLEX, platform and MAMA-GUARD browser suites | Passed; included existing-module regressions and Stage 4 role views, subject restriction, safety, dates, newborn links, facility provenance, REFLEX lifecycle and unsaved-form protection |
| Storage and error cases | Passed corrupted-store preservation, blocked-storage warning, session/reset lifetime and safety/source access during dataset failure |
| Responsive and keyboard checks | Passed all nine MAMA-GUARD tabs at 320, 390 and 768 px, visible control names and keyboard tab navigation |
| Production service-worker suites | Passed previous-module checks plus MAMA-GUARD safety, previously visited public map, memory-only reload and explicit uncached-region errors offline |
| `npm audit --audit-level=low` | Zero reported vulnerabilities on the review date; advisories change |

The Stage 1 smoke log includes a geographic raster request aborted during route navigation; the suite reported zero failures and no page/console errors. Tests used Chromium with software WebGL. They are not exhaustive security, accessibility, device, clinical or privacy validation.

## 7. Screenshots and future requirements

Final screenshots are in [`docs/previews/stage4/final/`](docs/previews/stage4/final/): `command-national.png`, `profile-ondo.png`, `antenatal-ondo.png`, `safety.png`, `facilities-ondo.png`, `referrals-ondo.png`, `postnatal-ondo.png`, `analytics-national.png`, `trust-and-sources.png`, and three mobile views. They show synthetic examples only.

Before any real patient use, establish independently reviewed clinical safety and local content, genuine identity and server-side least-privilege authorisation, secure data storage and transmission, audited consent and withdrawal, a verified and timestamped facility/readiness source, road and transport data, notification and care-delivery integrations, and privacy/security/accessibility governance. Any AI, evidence, language or speech service would require explicit approval, safety evaluation and human oversight. None is provided by this prototype.
