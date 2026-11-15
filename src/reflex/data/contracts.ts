import type { DataProvenance, FhirR4Resource, Role } from '../../types/domain';
import type { Referral, ReferralFilters, ReferralStatus } from '../types';

/** Design seams only. No implementation, network request, auth or FHIR mapping
 * is provided by these interfaces; the active demo uses useReflexStore. */
export interface FutureReferralQuery { region: string; filters: ReferralFilters; cursor?: string }
export interface FutureReferralPage { records: Referral[]; nextCursor?: string; provenance: DataProvenance }
export interface FutureReferralRepository {
  list(query: FutureReferralQuery): Promise<FutureReferralPage>;
  get(id: string): Promise<Referral | null>;
  save(record: Referral, expectedVersion: string | null): Promise<{ version: string }>;
  transition(id: string, next: ReferralStatus, expectedVersion: string): Promise<Referral>;
}
/** A real implementation would need independently authorised facility data,
 * timestamps, provenance, access controls and explicit operational semantics. */
export interface FutureFacilitySnapshot {
  id: string; displayName: string; region: string; lgaId: string | null; coordinates: [number, number] | null;
  serviceTags: Array<{ name: string; provenance: DataProvenance }>;
  operationalAvailability: 'unknown' | 'reported-available' | 'reported-unavailable';
  operationalProvenance: DataProvenance | null; provenance: DataProvenance;
}
export interface FutureVerifiedFacilitySource {
  find(region: string): Promise<FutureFacilitySnapshot[]>;
}
export interface FutureReferralInteroperability {
  toFhirR4(record: Referral): Promise<FhirR4Resource[]>;
  fromFhirR4(resources: FhirR4Resource[]): Promise<Referral>;
}
export interface FutureAccessPolicy { can(role: Role, operation: 'read' | 'create' | 'update' | 'export'): Promise<boolean> }
