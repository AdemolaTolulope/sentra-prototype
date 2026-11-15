"""Future backend contracts. No database, authentication or analytics is implemented."""
from datetime import datetime
from typing import Literal, Protocol
from pydantic import BaseModel, Field

Classification = Literal["verified", "user-submitted", "unverified", "synthetic", "estimated", "simulated"]
Verification = Literal["verified", "unverified", "synthetic", "not-connected"]

class DataProvenance(BaseModel):
    source: str
    source_url: str | None = None
    observed_at: datetime | None = None
    geographic_coverage: str
    classification: Classification
    verification: Verification
    limitations: str
    license: str | None = None

class TwinNode(BaseModel):
    id: str
    kind: Literal["community", "facility"]
    reference_id: str
    provenance: DataProvenance

class TwinEdge(BaseModel):
    id: str
    from_id: str
    to_id: str
    kind: Literal["referral", "access"]
    provenance: DataProvenance

# Stage 2 integration contracts only. No implementation or connected sources.
class GeoPoint(BaseModel):
    longitude: float
    latitude: float

class FacilityRegistryRecord(BaseModel):
    id: str
    name: str
    geography_id: str | None = None
    coordinates: GeoPoint | None = None
    category: str | None = None
    ownership: str | None = None
    registered_services: list[str] | None = None
    # A registered service does not establish current operational readiness.
    operational_availability: Literal['available', 'unavailable', 'unknown'] = 'unknown'
    provenance: DataProvenance

class RoutingRequest(BaseModel):
    origin: GeoPoint
    destination: GeoPoint
    mode: str

class RoutingResponse(BaseModel):
    distance_km: float | None = None
    duration_minutes: float | None = None
    provenance: DataProvenance
    limitations: list[str] = Field(default_factory=list)

class PopulationEstimate(BaseModel):
    geography_id: str
    modeled_population: float | None = None
    density_people_per_km2: float | None = None
    reference_year: int | None = None
    provenance: DataProvenance

# Stage 3 design envelopes only. These do not implement a repository, endpoint,
# authorisation, event store, FHIR conversion, or a schema approved for real
# patient data. They deliberately contain no patient-identifying fields.
class FutureReferralEventEnvelope(BaseModel):
    id: str
    occurred_at: datetime
    kind: Literal["created", "edited", "status", "counter-referral", "follow-up"]
    from_status: str | None = None
    to_status: str | None = None

class FutureReferralEnvelope(BaseModel):
    id: str
    origin_facility_id: str
    destination_facility_id: str | None = None
    service_category: str
    status: str
    events: list[FutureReferralEventEnvelope] = Field(default_factory=list)
    provenance: DataProvenance
    version: str | None = None

class FutureFhirR4Envelope(BaseModel):
    # Merely an opaque shape; no FHIR R4 validation or resource mapping exists.
    resource_type: str
    id: str | None = None
    payload: dict[str, object] = Field(default_factory=dict)

# Stage 3.5 service seams. These are non-operational types/protocols: there is
# no implementation, route, session validation, storage or clinical workflow.
PlatformRole = Literal['patient', 'clinician', 'operations', 'administrator']
PlatformLanguage = Literal['en', 'yo', 'ha', 'ig', 'pcm']
ProfessionalVerificationStatus = Literal[
    'not-submitted', 'submitted', 'awaiting-review', 'in-progress',
    'verified', 'rejected', 'suspended',
]

class SessionContext(BaseModel):
    state: Literal['unconfigured', 'unauthenticated', 'authenticated']
    subject_id: str | None = None
    roles: list[PlatformRole] = Field(default_factory=list)
    expires_at: datetime | None = None

class PermissionDecision(BaseModel):
    allowed: bool = False
    reason: str

class ConsentReference(BaseModel):
    subject_id: str
    scope: Literal['assessment:share', 'referral:share', 'email:send']
    recipient_id: str | None = None
    state: Literal['not-recorded', 'granted', 'withdrawn'] = 'not-recorded'

class ProfessionalApplicationReference(BaseModel):
    id: str
    category: str
    regulator: str
    status: ProfessionalVerificationStatus = 'not-submitted'

class EvidenceReference(BaseModel):
    id: str
    title: str
    source_url: str | None = None
    classification: Literal['verified', 'synthetic', 'estimated', 'simulated', 'unverified']
    reviewed_at: datetime | None = None

class SafetyDecision(BaseModel):
    # Emergency and uncertain decisions must interrupt ordinary intake.
    level: Literal['emergency', 'uncertain', 'clear-to-continue']
    message: str | None = None

class ReportReference(BaseModel):
    id: str
    subject_id: str
    status: Literal['current', 'superseded', 'entered-in-error']
    created_at: datetime
    content_type: str

class IdentityProvider(Protocol):
    async def session(self, credential: str) -> SessionContext: ...

class PermissionProvider(Protocol):
    async def check(self, session: SessionContext, action: str, resource_id: str | None) -> PermissionDecision: ...

class ConsentProvider(Protocol):
    async def check(self, subject_id: str, scope: str, recipient_id: str | None) -> ConsentReference: ...

class IntakeProvider(Protocol):
    async def next_question(self, context: dict[str, object]) -> str: ...

class EvidenceProvider(Protocol):
    async def retrieve(self, query: str, language: PlatformLanguage) -> list[EvidenceReference]: ...

class EmergencySafetyProvider(Protocol):
    async def screen(self, context: dict[str, object]) -> SafetyDecision: ...

class LanguageProvider(Protocol):
    async def translate(self, text: str, source: PlatformLanguage, target: PlatformLanguage) -> str: ...

class SpeechProvider(Protocol):
    async def transcribe(self, audio: bytes, language: PlatformLanguage) -> str: ...
    async def synthesise(self, text: str, language: PlatformLanguage) -> bytes: ...

class CareNavigationProvider(Protocol):
    async def find_options(self, context: dict[str, object]) -> list[dict[str, object]]: ...

class AssessmentProvider(Protocol):
    async def prepare(self, context: dict[str, object], evidence: list[EvidenceReference]) -> dict[str, object]: ...

class ReportProvider(Protocol):
    async def get(self, report_id: str) -> ReportReference: ...
    async def share(self, report_id: str, recipient_id: str, consent_id: str) -> None: ...

class FollowUpProvider(Protocol):
    async def plan(self, context: dict[str, object]) -> dict[str, object]: ...

class TelemedicineProvider(Protocol):
    async def request_appointment(self, context: dict[str, object]) -> dict[str, object]: ...
    async def join_session(self, appointment_id: str) -> str: ...

class CivilianEmergencyCoordinationProvider(Protocol):
    async def list_incidents(self) -> list[dict[str, object]]: ...
    async def request_resources(self, context: dict[str, object]) -> None: ...
