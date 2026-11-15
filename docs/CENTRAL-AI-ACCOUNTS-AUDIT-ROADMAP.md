# senTRA: central AI, accounts and platform intelligence
## Architecture audit and implementation roadmap

**Review date:** 12 November 2026, Africa/Lagos  
**Scope:** Existing `/home/user/sentra` source, the optional backend scaffold, local test scripts and the running production preview. This is an engineering audit, not a penetration test, clinical validation or legal opinion. No application functionality was changed during this review.

**Historical baseline:** this audit records the pre-implementation state. The later synthetic-only identity foundation and its remaining acceptance gaps are documented in [the Milestone 1 handover](MILESTONE-1-HANDOVER.md); references below to the backend being a scaffold describe the earlier audit, not the current source.

> **Current boundary:** senTRA is a synthetic prototype, not a healthcare service. Do not enter real patient or professional information. Account, consent, AI, clinical and telemedicine capabilities are not yet connected to production services.

## 1. Executive assessment

The application already has a coherent React workstation, working geographic exploration, a synthetic REFLEX referral lifecycle, a synthetic maternal journey and substantial regression coverage. Those should be extended, not rebuilt. The principal missing layer is a trusted backend that can establish identity, enforce access to a specific resource, record consent and audit events, and coordinate approved providers. The visible AI and account pages are deliberately locked because that layer does not yet exist.

**Recommended next step:** build a narrow, synthetic-only vertical slice for server-side identity, permissions, consent and audit, using the existing FastAPI scaffold and frontend. Connect a mature standards-based identity provider rather than treating a browser role switch or a homemade demo login as authentication. Keep clinical AI, real patient records, verified clinician access and real consultations unavailable until their own dependencies and approvals are in place.

## 2. What already exists—and what does not

| Area | Present in the project | Incomplete or not connected |
|---|---|---|
| Workstation | React 19, TypeScript and Vite; hash-based navigation and lazy-loaded workspaces in `src/App.tsx` and `src/services/route.ts`; existing dark/forest-green design. | Navigation is not an access-control boundary. There is no authenticated session in the shell. |
| senTRA AI | `src/platform/services/ai.ts` defines intake, safety, evidence, language, speech, navigation, assessment, reporting and follow-up interfaces. Tests demonstrate fail-closed ordering with mocked adapters. `AiGateway` shows fixed, scripted scenarios. | No real conversational input, model, clinical safety engine, evidence retrieval, speech or patient assessment. The orchestration test does not validate clinical safety. |
| Languages | English, Yoruba, Hausa, Igbo and Nigerian Pidgin are selectable preference codes in `src/platform/language.ts`. | The UI remains English. Translation, speech and language-specific clinical safety have not been implemented or validated. |
| Accounts | `AccountWorkspace.tsx` displays account and consent boundaries; `identity.ts` defines role, identity, consent and permission contracts and defaults to denial. | Registration, sign-in, logout, recovery, actual sessions, server enforcement and account records are absent. The buttons are disabled. `protectedAccess` currently refers directly to unconfigured adapters. |
| Backend | FastAPI scaffold and typed design envelopes in `backend/app/`. The custom `/health` endpoint reports that authentication and health data are not connected. | No identity or clinical APIs, database, migrations, audit service or deployed provider. FastAPI also exposes its default documentation routes. Python dependencies have version ranges but no lock file in the reviewed tree. |
| Professionals | `ProfessionalOnboarding.tsx` provides an editable, memory-only synthetic profile and a simulated review timeline; `professional.ts` lists categories and possible verification states. | No submitted applications, credential upload, independent review, regulator integration or verified clinicians. Registration must not grant verification. |
| Reports and consent | `ReportsWorkspace.tsx` downloads a fixed synthetic text example. Interfaces describe future report and consent services. | No real assessment document, consent recording, secure sharing, revocation or email delivery. Sharing controls are disabled. |
| Telemedicine | `TelemedicineWorkspace.tsx` and `services/telemedicine.ts` define future appointment, video and notification boundaries. | No verified clinician directory, scheduling, availability, calls, notifications or completed consultations. |
| GEOACCESS | Published geographic context, optional imagery, modeled population, mapped OSM points and **111 fictional facilities** are used by the existing map and shared views. The demo facility IDs are reused by REFLEX and MAMA-GUARD. | There is no verified facility registry or live readiness. All 111 demo facilities have unknown operational availability. Mapped OSM healthcare points are unverified; their display IDs are not reliable registry identities. |
| REFLEX | A functioning **synthetic** referral lifecycle, status/event history, matching, follow-up and cross-module links. The demo store is local to the browser. | `src/reflex/data/useReflexStore.ts` writes unencrypted synthetic records to `localStorage`; updates are last-writer-wins and there is no authenticated multi-user repository, real messaging, protected audit or actual consent. |
| MAMA-GUARD | Functional synthetic maternal/newborn examples, appointments, role perspectives, provenance cues and a synthetic REFLEX handoff. | `MamaSession.tsx` keeps examples and audit-style events in memory; roles and consent are simulations. Reloading loses this state, unlike the longer-lived REFLEX demo store. |
| Operations | Uses the shared geographic context and synthetic referral indicators, with clear prototype labels. | No authenticated operational roles, current health-service feed or approved access to patient records. |
| MEDILENS / SENTINEL | Foundation pages, synthetic metrics and planned-capability descriptions in `src/pages/ModulePage.tsx`. | Neither is an operational medicines, diagnostics or public-health service. The AI must not claim it can query a live service that does not exist. |

### Duplication and integration risks to resolve

1. **Roles and authorization:** `src/types/domain.ts`, `src/platform/services/identity.ts`, `src/mamaguard/types.ts` and `src/reflex/types.ts` contain different generic, platform and simulated role vocabularies. Define a server-owned permission model and explicit adapters; do not make a frontend role selector authoritative.
2. **Consent:** platform `ConsentState` and REFLEX/MAMA-GUARD `DemoConsent` have different meanings. Simulated permission must never be promoted into real consent. Create a versioned, purpose- and recipient-scoped server record and preserve demo values as demo values.
3. **Referrals, appointments and profiles:** the Stage 1 placeholder referral differs from the richer REFLEX synthetic lifecycle; MAMA-GUARD visits and the telemedicine appointment contract are separate. Establish canonical server records and transition rules, then adapt existing screens incrementally. Do not silently replace existing examples or imply that a visit was booked or completed.
4. **Audit:** REFLEX browser events and the bounded, memory-only MAMA-GUARD audit-style history are useful demonstrations, not a protected audit trail. A separate server-side audit mechanism is required.
5. **Facilities and geography:** preserve existing fictional facility IDs within demo flows. Use separate identity namespaces and provenance for future registry records and OSM points; do not merge them solely by name or treat a mapped point as a verified, available facility.
6. **Browser storage and caching:** workspace preferences use IndexedDB, REFLEX uses localStorage, and the service worker caches the static shell and selected public geographic files. Real health data, sessions and reports must not be placed in those stores or public static-data paths. Future sensitive API responses need explicit `no-store` handling and regression tests against browser/service-worker caches. A user-initiated download necessarily creates a local copy outside server control and must be explained.
7. **External geography services:** current optional imagery and map providers can receive the viewer's IP address and viewport. A future patient-linked view must not silently disclose precise sensitive location or patient information to them.
8. **Delivery hygiene:** this reviewed workspace is not a Git working tree and has no CI, container or database configuration in the project tree. The current execution environment has no Docker/Podman or PostgreSQL binaries. Preserve the delivered archives; establish version control, repeatable migrations, dependency locking and automated checks before the larger implementation.

## 3. Proposed target architecture

```text
Existing React workstation and existing synthetic modules
  ├─ Public/synthetic mode: current GEOACCESS, REFLEX and MAMA-GUARD demos
  └─ Account-aware views: display hints only; never enforce access alone
             │ HTTPS, same-origin /api, no-store for sensitive responses
             ▼
Existing FastAPI backend, extended incrementally
  ├─ Identity adapter + server-managed session ── approved OIDC provider
  ├─ Authorization: subject + action + resource + relationship + purpose
  ├─ Consent and protected audit services
  ├─ Versioned repositories for profiles, reports, referrals, appointments
  └─ Central AI coordinator, behind the same authorization and safety gates
       ├─ model / language / speech provider adapters
       ├─ reviewed safety and escalation service
       ├─ approved evidence retrieval with source and version metadata
       └─ allowlisted module interfaces; writes require explicit confirmation
             │
             ▼
Separately configured database, evidence, registry, scheduling and
communication providers; each remains unavailable until actually connected
```

- **Do not rewrite the frontend or replace the map.** Adapt the existing workspaces and service interfaces. Keep the current synthetic mode and its browser data clearly separate from any future protected environment.
- **Identity:** recommend an OIDC-compatible identity provider using authorization-code flow with PKCE, with exact redirect configuration and server validation; a server-managed, `HttpOnly`/`Secure` session cookie, session rotation, CSRF protection and revocation are preferable to storing tokens in localStorage. The OAuth security guidance is a design reference, not a certification [1](https://www.rfc-editor.org/info/rfc9700/). Registration, password recovery and email verification are provider-specific capabilities; OIDC by itself does not implement them.
- **Authorization:** server-side, deny by default and check each operation against the specific object, actor, scope and relevant relationship—not merely a claimed role. Client checks are presentation only [1](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html). Operations access should default to scoped aggregates; an administrator role must not automatically grant access to patient records.
- **Consent and provenance:** record who granted or withdrew what, to whom, for which purpose and resource, and when. Check the current grant on every protected access. Withdrawal prevents subsequent authorized access according to policy; it cannot automatically erase copies already legitimately downloaded or transmitted. Document other lawful bases and exceptions with legal counsel rather than silently assuming a blanket rule.
- **Records:** separate patient-reported statements, AI-generated interpretation and clinician-entered/signed findings; capture author, time, source, verification state and version. A clinician signature or professional verification is not proof that a clinical conclusion is correct.
- **AI safety:** screen before routine continuation, make uncertainty or a failed safety service interrupt the normal flow, and provide clinically reviewed escalation wording. Do not claim a safety screen catches every emergency. Restrict model tools to explicitly allowed, separately authorized operations and require human confirmation for consequential writes. Plan for prompt injection, sensitive-information disclosure and over-broad tool access [1](https://genai.owasp.org/initiatives/top-10-for-llm-and-genai/).
- **Evidence:** retrieve only from approved sources, record the source, URL, version and review date, and avoid invented citations. Source availability or retrieval is not itself clinical validation.
- **Interoperability:** design a canonical internal model first. Consider FHIR R4 mappings and validated profiles when a specific external integration requires them; a FHIR-shaped object is not FHIR compliance [1](https://hl7.org/fhir/r4/Consent.html).
- **Environments:** keep synthetic development/test data, identities and credentials separate from future staging and production. Never automatically copy local demo records into a real patient database. Encrypt and restrict protected data in transit and at rest in any approved deployment; protect backups and secrets too.

## 4. First milestone to approve: identity and access foundation

### Goal

Deliver a small but real **server-enforced identity and access foundation**, demonstrated with synthetic accounts and records, while leaving all existing modules and clinical boundaries intact. This is not a release for real patient information.

### Proposed deliverables

1. **Threat model and data map:** trust boundaries, roles, protected resources, consent flows, storage/caching, external providers and abuse cases; document what is deliberately out of scope.
2. **Backend identity/session integration:** extend FastAPI behind `/api`; use a provider-neutral OIDC adapter configurable for local test, managed and self-hosted identity services, with server session lifecycle, sign-in/sign-out, expiration and protected endpoint patterns. Use each configured provider's supported registration, email-verification and password-recovery flows; do not invent a password service. Supporting the common interface does not mean every provider is already connected or tested.
3. **Persistent account foundation:** migrations and repositories for minimal account/profile data, roles and verification state; use a properly provisioned database. Patient and professional applicants may register, but a self-declared professional remains **pending/unverified**. Operations and administrator access are provisioned through an authorized process, not self-selected at registration.
4. **Server-side permissions:** a centrally tested deny-by-default policy plus object/subject checks on every protected route. Patient accounts can access only their own synthetic profile; unverified clinicians cannot access another person's information; administrators do not automatically receive clinical access.
5. **Consent and audit foundation:** demonstrate a purpose- and recipient-scoped grant and withdrawal against a synthetic test resource, with a restricted server-side event record for authentication, access decisions and consent changes. A test-only verified-clinician fixture is not a real verification. Never log passwords, tokens or assessment content.
6. **Existing account UI made functional against that backend:** registration, login, logout, recovery entry points and minimal patient/professional profile views, retaining the existing visual identity. Synthetic status and unavailable external delivery are explicit; no role selector unlocks protected records.
7. **Tests and setup documentation:** backend unit/integration and browser tests; isolated configuration, migrations and a repeatable development setup. Preserve and run existing GEOACCESS, REFLEX, MAMA-GUARD, platform and satellite regressions appropriate to touched code.

### Acceptance checks

- Two synthetic patients cannot read or change one another's resource by changing an ID or frontend role. An unauthenticated session, expired session, pending clinician or unauthorized administrator is denied.
- A test-only clinician can see only the synthetic item specifically granted by its owner; withdrawing the grant blocks subsequent access, including direct API access. Access/denial and consent events are recorded without sensitive content.
- Registration, sign-in, logout, recovery and session expiration work **against a configured test identity provider**; privileged roles cannot be self-assigned. Session rotation, CSRF, invalid tokens, recovery abuse and cross-account object access are tested.
- Sensitive API responses are not stored in localStorage, IndexedDB, service-worker caches or public static directories; existing public offline geography still works. No real patient data is used.
- Existing synthetic maps, referral and maternal journeys remain usable and labelled. Existing regression failures block milestone sign-off.

### Dependencies and honest limits

- **Identity approach selected:** support local test, managed and self-hosted providers through one provider-neutral interface where compatible. The specific providers, test configurations and deployment environment remain to be supplied. A protocol test double can exercise integration logic, but it cannot prove that real registration, email delivery or recovery is configured. The milestone is not fully signed off until tested with an actual disposable provider and test mailbox; each additional provider must be tested separately before it is claimed as connected.
- A reachable database is required for real persistence tests. PostgreSQL is a sensible default because the existing scaffold already anticipates it; this workspace currently has neither PostgreSQL nor a container runtime. A documented development setup or user-provided test service will be needed.
- A test email mechanism is needed for recovery testing; real email or SMS delivery is a separate configured integration. No credentials or secrets are bundled or requested in chat.
- This milestone does **not** provide clinical AI, clinician verification, real patient records, facility readiness, real referral transmission, telemedicine or production security/clinical certification.

## 5. Sequenced roadmap after the first milestone

| Milestone | Deliverables | Exit gate / dependency |
|---|---|---|
| **2. Professional identity and consent** | Professional profile, secure credential submission and review queue, explicit pending/verified/rejected/suspended lifecycle; recipient- and purpose-specific sharing controls. | An authorized review process and secure document handling. Pending status never grants clinical access; verification and a valid care relationship/grant are both checked. |
| **3. Central AI and structured assessment** | Server-side provider adapters; text intake and follow-up; reviewed safety interruption; approved evidence retrieval with attribution; structured synthetic assessment with patient/AI/clinician provenance. | Clinical owner, reviewed intended use and escalation criteria, model/evidence provider agreement, safety evaluation and adversarial tests. Until then, real health input remains disabled. |
| **4. Connected patient and clinician journeys** | Account-linked synthetic histories and reports; protected read/download and consent-based sharing; clinician-entered findings; scoped links to GEOACCESS, REFLEX and MAMA-GUARD. Preserve existing demo paths via adapters. | Server-side ownership and consent, durable record/version semantics, no silent merging of demo and real records, and end-to-end authorization tests. Real facility navigation needs a separately sourced registry. |
| **5. Care coordination and telemedicine** | Clinician discovery, appointment request/status and follow-up lifecycle, report-sharing and provider-neutral consultation/notification interfaces. | Independent verification, a real directory and scheduling source, communications provider and consent. No live availability or completed call is claimed until confirmed by the relevant service and authorized actor. |
| **6. Multilingual and voice** | English, Yoruba, Hausa, Igbo and Nigerian Pidgin interface/content and provider-backed speech, with explicit text fallback. | Provider language coverage, local linguistic and clinical review, speech privacy/retention terms, accessibility and language-specific safety tests. Unsupported or unvalidated languages stay labelled unavailable rather than being assumed accurate. |
| **7. Wider module integration and release readiness** | Permission-aware module interfaces for GEOACCESS, REFLEX, MAMA-GUARD and Operations; add MEDILENS/SENTINEL capabilities only when those services exist. Operational monitoring, incident response, backup/recovery and independent review. | Verified sources, least-privilege tools, privacy/security/clinical and accessibility review, provider contracts and explicit go-live approval. |

Security, data protection, clinical governance and regression testing are cross-cutting throughout—not postponed until the final row. WHO's guidance is a useful clinical-AI governance reference [2](https://apps.who.int/iris/handle/10665/341996). Before any real-data pilot, obtain professional review of the Nigeria Data Protection Act 2023 [1](https://ndpc.gov.ng/wp-content/uploads/2024/03/Nigeria_Data_Protection_Act_2023.pdf), the NDPC's 2025 implementation directive [2](https://ndpc.gov.ng/wp-content/uploads/2025/07/NDP-ACT-GAID-2025-MARCH-20TH.pdf), applicable health/telemedicine requirements, a data-protection impact assessment as appropriate, and independent security and clinical safety assessments. No compliance or certification is implied by this plan.

## 6. Decisions needed before external integrations

1. **Identity:** the desired approach is to support local disposable, managed and self-hosted OIDC services through a common interface. Which specific providers will be used, which can supply a test tenant and recovery email, and should more than one be active at once?
2. **Hosting and database:** where will FastAPI and PostgreSQL run for development/staging, and who manages secrets, backups, encryption and operational access?
3. **Professional verification:** who is the authorized reviewer and which regulator/registry checks can legally and practically be used for each profession?
4. **Clinical and AI governance:** who owns intended use, safety/escalation wording, evidence review, language validation and final clinical approval? Which model/speech providers and data-processing terms are acceptable?
5. **Real care coordination:** which authoritative facility directory, appointment system and video/notification providers are available? Their absence means the related features remain explicitly unavailable.

## 7. Audit checks actually performed

- Read the current frontend entry points, account/AI/report/professional/telemedicine adapters and screens, GEOACCESS data types, REFLEX and MAMA-GUARD stores, backend scaffold, service worker, handovers and test scripts.
- Ran Node 22 TypeScript typecheck and core data, GEOACCESS, REFLEX, platform and MAMA-GUARD suites: all passed.
- Exercised the existing FastAPI application in-process: `/health` returned HTTP 200 with authentication and health-data connections explicitly false. No backend authentication suite exists in the reviewed tree.
- Ran a targeted browser smoke test on the existing production preview: AI remained locked; sign-in/recovery, report sharing and appointments were disabled; professional submission remained simulated; GEOACCESS, REFLEX and MAMA-GUARD loaded.
- This was not a full new browser-regression run, real provider integration test, independent security assessment, clinical validation or proof of regulatory compliance. The previous satellite-map handover records the broader regression run performed for that update.
