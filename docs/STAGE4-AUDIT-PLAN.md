# Stage 4 MAMA-GUARD — architecture audit and implementation plan

Audit date: 12 November 2026. This is the pre-implementation audit and plan; for the implemented result and verification see [HANDOVER-STAGE4.md](../HANDOVER-STAGE4.md). This stage extends the existing application and is not an operational clinical system.

## Existing integration points

- `#/mama-guard` is currently the Stage 1 `ModulePage` placeholder. `App.tsx` can lazy-load a dedicated module at that existing route without changing other route URLs. Shared navigation, `WorkspaceContext`, geography, sidebar, footer and dark workstation tokens are already in place.
- `src/geoaccess/data/adapters.ts`, `types.ts` and `engine/calculations.ts` provide geographic selection, 111 **fictional** facilities and great-circle distance. Only 19 records currently carry the fictional `Maternal care` tag. No real maternity, newborn, emergency-obstetric, staffing, stock, bed or service-readiness data is connected. Do not infer obstetric/newborn capability from a generic emergency tag.
- `src/reflex/` provides the existing synthetic referral form, matching, lifecycle, counter-referral and follow-up. `ReflexSessionProvider` preserves unsaved forms across SPA routes; `useReflexStore` stores its synthetic examples in unencrypted localStorage. Use a synthetic patient reference and existing REFLEX form/store rather than creating a second referral engine. Protect an existing unsaved referral form from accidental replacement.
- `src/platform/services/identity.ts` and `ai.ts` define unconfigured/fail-closed identity, authorisation, consent and AI service boundaries. There is no authenticated session, secure patient store, audit service, clinical AI, speech or knowledge retrieval. Real patient-facing actions must remain unavailable; role labels or local toggles cannot grant authority.
- Stage 3.5's `PlatformPrimitives`, design tokens and components support a coherent shell. The service worker precaches emitted static chunks and only caches visited public geographic data; it must not cache maternal records or API responses.
- Existing Stage 1, GEOACCESS, REFLEX, platform and offline scripts are the regression baseline. The running production preview on 5173 will be preserved during development.

## Safety and data decisions

1. Provide interactive **synthetic-only** demonstrations. Maternal and newborn example state will remain in memory for the current SPA session and disappear on reload; it will not be persisted to IndexedDB/localStorage. Use generated pseudonymous IDs, controlled choices and no names, contact details or open clinical narrative. Simulated changes are not authenticated clinical documentation. REFLEX continues its existing unencrypted synthetic local store and must never receive real patient data.
2. Separate patient-reported, simulated clinician-entered, system-reminder and AI-generated categories. No diagnosis, automatic pregnancy inference, risk score or false reassurance. Known warning signs remain visible without a questionnaire and cannot be overridden by an ordinary workflow. No real symptoms are assessed.
3. Use public sources with date and review status: WHO/UNFPA/UNICEF/World Bank, *Pregnancy, childbirth, postpartum and newborn care*, third edition (2015), https://iris.who.int/handle/10665/249580; WHO, *Newborn health* (30 August 2021), https://www.who.int/europe/news-room/fact-sheets/item/newborn-health; WHO postnatal update (30 March 2022), https://www.who.int/news/item/30-03-2022-who-urges-quality-care-for-women-and-newborns-in-critical-first-weeks-after-childbirth. Content is educational and requires independent local maternal-health review; sources do not imply endorsement of senTRA.
4. ANC, PNC, newborn and immunisation appointments are individually entered fictional examples. No universal schedule or treatment recommendation is hardcoded. The demo marks scheduled events overdue by date; a missed visit is a separate explicit simulated action. Reminders are local indicators, not notifications.
5. Maternal facility matching can compare fictional maternal tags and straight-line distance via existing GEOACCESS/REFLEX engines. Every result is synthetic, availability unknown, not a recommendation or proof of maternity/emergency/newborn readiness. Real registry, service and travel-time integrations remain unavailable.
6. Real AI, text/voice interaction, consent, secure sharing and clinician authorisation remain locked. A fixed demonstration and a link to the central gateway may illustrate intended integration; no real patient summary is transmitted.
7. Analytics use only the displayed synthetic sample and explicitly label numerator, denominator and simulated status. No Nigerian maternal mortality, morbidity, coverage or real facility-performance statistic is invented. Published geographic context and population estimates keep their existing provenance and limitations.

## Milestones

1. **Audit and plan** — this file; identify reuse and safety risks before edits.
2. **Module shell and synthetic model** — dedicated route, common filters, memory-only records and provider boundaries.
3. **Maternal profile and ANC** — synthetic create/update, configurable appointments, explicit missed/overdue handling and labelled source categories.
4. **Safety and evidence** — immediately visible warning signs, urgent care advice and source metadata, no diagnosis or automated clinical triage.
5. **Facilities and REFLEX integration** — explainable fictional matching, GEOACCESS inspection and a consent-aware synthetic handoff into the existing REFLEX lifecycle.
6. **Postnatal/newborn continuity** — linked fictional follow-up and immunisation tracking with no implied universal schedule.
7. **Analytics, AI and role boundaries** — denominators and provenance, central locked AI link, future server-side contracts and simulated audit markers.
8. **Regression and handover** — functional, integration, safety, responsive, offline and existing-module tests; document actual limitations, screenshots and source archive.

## Material risks

- No real authentication or secure storage means the requested authorised patient workflows cannot be safely implemented as live features. Any editable interface is a simulation, not a protected record.
- Clinical content and schedules require qualified review and local adaptation before use. A static danger-sign list is not exhaustive and cannot replace emergency care.
- REFLEX stores only synthetic data in unencrypted browser storage. Handoffs must carry no real clinical details and must not overwrite unsaved forms without confirmation.
- Public geographic context is not proof of current maternal services; matching and coverage-like results are demonstrations only.
- Any real deployment needs a verified facility/availability source, consent and audit services, independently evaluated AI, privacy/security assessment and clinical governance.
