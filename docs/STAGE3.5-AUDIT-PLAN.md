# Stage 3.5 — architecture audit and implementation plan

Audit date: 12 November 2026. This is a continuation of the existing React 19 / TypeScript / Vite application, not a replacement. Stage 4 MAMA-GUARD is out of scope.

## Existing architecture

- `src/App.tsx` contains the hash-based route switch, shared application shell and provider boundaries. `src/services/route.ts`, `src/components/navConfig.tsx`, `Sidebar.tsx` and `Topbar.tsx` provide navigation. Existing route URLs must remain valid.
- `WorkspaceContext` and `useWorkspace` hold shared geography and non-sensitive display preferences. Stage 1's `IntelligenceProvider` supplies explicit demonstration data. Its preferences are in IndexedDB; they must not become a store for health or identity information.
- GEOACCESS is lazy-loaded in `src/geoaccess/` and already uses MapLibre, deck.gl, Turf, shared state/FCT geography, published 2022 boundaries, WorldPop 2020 and explicitly fictional facility examples. It provides a 2D/3D map and state/LGA/facility inspection. Its data adapters and existing map can be reused without adding Cesium or another map framework.
- REFLEX is lazy-loaded in `src/reflex/`; it has nine connected views, a synthetic-only version-1 local store, matching, directed network, simulation, lifecycle and GEOACCESS handoff. Its synthetic storage is not a patient-data repository, a security boundary or a real referral service.
- The optional FastAPI scaffold exposes only `/health` and future types. There is **no identity provider, authenticated account, backend authorisation, secure patient store, AI provider, speech provider, retrieval service, appointment/video provider, notification service, FHIR server or verified clinical registry**.
- The existing service worker precaches the shell and emitted assets and caches public geographic files on demand. Existing Stage 1, GEOACCESS and REFLEX browser/core/offline tests provide the regression baseline.

## Decisions and safety gates

1. Add three workspace entry points and preserve every old route and module. Workspace and role selectors are navigation previews only, never authentication or authorisation. Existing GEOACCESS and REFLEX continue to run in their established routes.
2. Adopt shared dark workstation tokens on the shell and new pages; make scoped, non-destructive visual changes to GEOACCESS/REFLEX. Maintain keyboard, small-screen and reduced-motion support.
3. **Registered-users-only is a hard gate.** No simulated role or client-side flag will be treated as an authenticated account. Until a genuine configured identity provider and server-side authorisation exist, real AI text/voice input, clinical reports, sharing and consultations remain locked/unavailable. An explicitly labelled fixed synthetic workflow preview may demonstrate architecture; it is not an anonymous consultation or medical assessment.
4. Account, professional registration and consent interfaces use synthetic/ephemeral examples only. Never persist real patient/professional input in unencrypted browser storage. A submitted number or profile is not a verification. Verification states are pending/simulated only.
5. Create provider-independent TypeScript and backend contract seams for identity, permission, consent, AI intake, retrieval/evidence, safety, languages/speech, assessment/reporting, care navigation, telemedicine and follow-up. An unconfigured adapter must fail closed. No secrets in frontend code; no false live retrieval, diagnosis, communication, availability or notifications.
6. Reuse MapLibre/deck.gl and the GEOACCESS sources in a large operations geographic view. Height represents modeled population density, not real terrain, facility capacity or access. Separate fictional facilities and referral lines from published or estimated geography; future overlays remain visibly unavailable unless supported.
7. Civilian emergency-health coordination will use explicitly simulated, non-operational structures and existing geography/referral handoffs. No invented incidents, resource inventories, teams or response deployment.
8. Run existing Stage 1/GEOACCESS/REFLEX regression suites along with new permission, data-boundary, accessibility, voice-capability, navigation, map and offline tests. Record partial work and service blockers rather than representing interfaces as operational systems.

## Milestones

1. **Audit and plan** — this document; identify missing identity/services and safe integration points.
2. **Design and navigation** — shared shell/tokens and three navigable workspaces; old routes intact.
3. **Identity/account foundation** — role-preview structure, account and consent boundaries, synthetic clinician registration and honest verification states; no unauthenticated access to AI interaction.
4. **senTRA AI architecture** — locked registered-only interface; language/speech capabilities and modular adapters; safe fixed demonstrations only while providers are absent.
5. **Reports and navigation** — synthetic, non-clinical report/interface examples and explicit disabled sharing/email; GEOACCESS/REFLEX handoffs without passing patient data.
6. **Clinician/telemedicine** — onboarding preview, pending verification, appointment and consultation boundaries; no fake availability/calls.
7. **3D intelligence environment** — prominent MapLibre/deck.gl map, controls, contextual data/provenance and supported layers; disclose unavailable overlays.
8. **Emergency coordination** — civilian-only simulation design, geographic/referral handoffs and unavailable incident/resource services.
9. **Integration** — cross-workspace navigation and data contracts without compromising existing modules or privacy.
10. **Regression/handover** — browser/core/offline checks, dependency audit, screenshots, clear limitations and an updated verified archive.

The outcome must be reviewed before any Stage 4 development. Enabling real patient workflows later requires approved identity, providers, consent, secure backend storage and independent clinical/security review.
