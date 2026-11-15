import { ServiceUnavailable } from './identity';
/** Civilian healthcare and humanitarian coordination boundaries only.
 * No live feed, inventory, incident submission or dispatch implementation. */
export type IncidentVerification='unverified'|'under-review'|'verified'|'rejected';
export type IncidentLifecycle='draft'|'reported'|'reviewing'|'closed';
export interface IncidentReference {id:string;classification:'UNVERIFIED'|'VERIFIED';verification:IncidentVerification;lifecycle:IncidentLifecycle;sourceId:string;observedAt:string|null}
export interface HumanitarianResourceRequest {incidentId:string;requesterId:string;resourceCategory:string;purpose:string}
export interface EmergencyIncidentAdapter {list():Promise<IncidentReference[]>;submit(reference:IncidentReference):Promise<void>}
export interface HumanitarianCoordinationAdapter {request(input:HumanitarianResourceRequest):Promise<void>}
const unavailable=async ():Promise<never>=>{throw new ServiceUnavailable('Civilian emergency coordination services are not configured.');};
export const unconfiguredIncidents:EmergencyIncidentAdapter={list:unavailable,submit:unavailable};
export const unconfiguredHumanitarianCoordination:HumanitarianCoordinationAdapter={request:unavailable};
