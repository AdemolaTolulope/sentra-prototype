import { ServiceUnavailable } from './identity';
/** Boundaries for future, separately authorised services; no provider exists. */
export type AppointmentStatus='requested'|'accepted'|'cancelled'|'completed';
export interface AppointmentRequest {patientId:string;professionalId:string;consentId:string;requestedTime:string}
export interface Appointment {id:string;patientId:string;professionalId:string;status:AppointmentStatus;startAt:string}
export interface AppointmentAdapter {request(input:AppointmentRequest):Promise<Appointment>;get(id:string):Promise<Appointment>;cancel(id:string):Promise<void>}
export interface VideoAdapter {join(appointmentId:string):Promise<{sessionUrl:string}>;end(appointmentId:string):Promise<void>}
export interface NotificationAdapter {send(recipientId:string,templateId:string,consentId:string):Promise<void>}
const unavailable=async ():Promise<never>=>{throw new ServiceUnavailable('Telemedicine services are not configured.');};
export const unconfiguredAppointments:AppointmentAdapter={request:unavailable,get:unavailable,cancel:unavailable};
export const unconfiguredVideo:VideoAdapter={join:unavailable,end:unavailable};
export const unconfiguredNotifications:NotificationAdapter={send:unavailable};
