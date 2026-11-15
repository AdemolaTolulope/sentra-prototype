/** Contracts are intentionally separate from the demo provider, so a real API can replace it. */
export type DataClassification = 'verified' | 'user-submitted' | 'unverified' | 'synthetic' | 'estimated' | 'simulated';
export type VerificationStatus = 'verified' | 'unverified' | 'synthetic' | 'not-connected';
export interface DataProvenance {
  source: string;
  sourceUrl?: string;
  observedAt: string | null;
  geographicCoverage: string;
  classification: DataClassification;
  verification: VerificationStatus;
  limitations: string;
  license?: string;
}
export type GeographyLevel = 'national' | 'state' | 'fct' | 'lga' | 'ward' | 'community';
export interface Geography { id: string; name: string; level: GeographyLevel; parentId?: string; provenance: DataProvenance }
export interface Facility { id: string; displayName: string; geographyId: string; coordinates?: [number, number]; services: string[]; readiness?: number; provenance: DataProvenance }
export interface Community { id: string; geographyId: string; coordinates?: [number, number]; population?: number; provenance: DataProvenance }
/** Stage 1 generic placeholder. The active synthetic lifecycle is in reflex/types.ts. */
export interface Referral { id: string; originId: string; destinationId: string; status: 'planned' | 'in-progress' | 'completed'; provenance: DataProvenance }
export interface AvailabilityReport { id: string; facilityId: string; category: 'medicine' | 'diagnostic'; status: 'available' | 'limited' | 'unavailable' | 'unknown'; provenance: DataProvenance }
export interface SurveillanceIndicator { id: string; geographyId: string; value: number | null; uncertainty?: string; provenance: DataProvenance }
export interface ExplainableResult<T> { value: T | null; inputs: DataProvenance[]; method: string; limitations: string[]; generatedAt: string | null }
// Future digital-twin contracts only. The REFLEX demo graph and simulator use separate synthetic models; no operational digital twin runs.
export interface TwinNode { id: string; kind: 'community' | 'facility'; referenceId: string; provenance: DataProvenance }
export interface TwinEdge { id: string; from: string; to: string; kind: 'referral' | 'access'; provenance: DataProvenance }
export interface TwinScenario { id: string; name: string; changes: Array<{ targetId: string; property: string; proposedValue: unknown }>; status: 'draft' | 'not-run' }
// A narrow FHIR R4-shaped envelope for future interoperability; not a FHIR server.
export interface FhirR4Resource { resourceType: string; id?: string; meta?: { versionId?: string; lastUpdated?: string }; [key: string]: unknown }
export type Role = 'community-contributor' | 'facility-officer' | 'analyst' | 'administrator';
