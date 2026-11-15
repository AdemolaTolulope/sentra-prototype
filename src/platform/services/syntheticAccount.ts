/** Same-origin, synthetic-only account API. This does not grant access to the
 * other workspaces. Server responses, not browser state, authorize operations.
 * CSRF values remain in React memory; session cookies are HttpOnly. */
import { isLanguageCode, type LanguageCode } from '../language';
import { professionalCategories, type ProfessionalCategory } from './professional';

export interface AccountServiceStatus {
 mode:'disabled'|'synthetic'; storage:'synthetic-local'|'unavailable';
 provider:'unconfigured'|'configured-not-verified';
 sign_in_configured:boolean; registration_configured:boolean; recovery_configured:boolean; email_verification_required:boolean;
 email_delivery_connected_by_app:boolean; professional_verification_connected:boolean; real_health_data_supported:boolean;
}
export interface SyntheticProfile {
 id:string; classification:'synthetic'; role:'patient'|'professional'|'operations'|'administrator';
 verification:'not-applicable'|'unverified'|'verified'|'suspended'; language:LanguageCode;
 professional_category:ProfessionalCategory|null;
}
export interface SyntheticSession {profile:SyntheticProfile;expires_at:number;csrf_token:string}
export interface SyntheticResource {id:string;classification:'synthetic';created_at:number}
export interface SyntheticGrant {
 id:string;resource_id:string;recipient_id:string;scope:'assessment:read';purpose:'care-coordination';
 granted_at:number;expires_at:number;revoked_at:number|null;status:'active'|'withdrawn'|'expired';classification:'synthetic';
}
export class AccountApiError extends Error {
 constructor(public readonly status:number, message:string){super(message);this.name='AccountApiError';}
}
const object=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const number=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const category=(value:unknown):value is ProfessionalCategory|null=>value===null||professionalCategories.some(item=>item.value===value);
function invalid():never{throw new AccountApiError(0,'The account service returned an unexpected response.');}
function parseStatus(value:unknown):AccountServiceStatus {
 if(!object(value)||!['disabled','synthetic'].includes(String(value.mode))||!['synthetic-local','unavailable'].includes(String(value.storage))||!['unconfigured','configured-not-verified'].includes(String(value.provider)))return invalid();
 for(const key of ['sign_in_configured','registration_configured','recovery_configured','email_verification_required','email_delivery_connected_by_app','professional_verification_connected','real_health_data_supported'])if(typeof value[key]!=='boolean')return invalid();
 // Never activate this synthetic interface against a service advertising real-data support.
 if(value.real_health_data_supported!==false)return invalid();
 return value as unknown as AccountServiceStatus;
}
function parseProfile(value:unknown):SyntheticProfile {
 if(!object(value)||!uuid(value.id)||value.classification!=='synthetic'||!['patient','professional','operations','administrator'].includes(String(value.role))||!['not-applicable','unverified','verified','suspended'].includes(String(value.verification))||!isLanguageCode(value.language)||!category(value.professional_category))return invalid();
 return value as unknown as SyntheticProfile;
}
function parseSession(value:unknown):SyntheticSession {
 if(!object(value)||value.status!=='authenticated'||!number(value.expires_at)||typeof value.csrf_token!=='string'||!/^[0-9a-f]{64}$/.test(value.csrf_token))return invalid();
 return {profile:parseProfile(value.profile),expires_at:value.expires_at,csrf_token:value.csrf_token};
}
function parseResources(value:unknown):SyntheticResource[] {
 if(!Array.isArray(value))return invalid();
 return value.map(item=>{
  if(!object(item)||!uuid(item.id)||item.classification!=='synthetic'||!number(item.created_at))return invalid();
  return item as unknown as SyntheticResource;
 });
}
function parseGrants(value:unknown):SyntheticGrant[] {
 if(!Array.isArray(value))return invalid();
 return value.map(item=>{
  if(!object(item)||!uuid(item.id)||!uuid(item.resource_id)||!uuid(item.recipient_id)||item.scope!=='assessment:read'||item.purpose!=='care-coordination'||item.classification!=='synthetic'||!number(item.granted_at)||!number(item.expires_at)||(item.revoked_at!==null&&!number(item.revoked_at))||!['active','withdrawn','expired'].includes(String(item.status)))return invalid();
  return item as unknown as SyntheticGrant;
 });
}
async function call(path:string, options:RequestInit={}):Promise<Response> {
 let response:Response;
 try{response=await fetch(`/api/identity${path}`,{...options,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...options.headers}});}
 catch(error){if(error instanceof DOMException&&error.name==='AbortError')throw error;throw new AccountApiError(0,'The account backend is unavailable.');}
 if(!response.ok){
  if(response.status===401)throw new AccountApiError(401,'The synthetic session is no longer active.');
  if(response.status===403)throw new AccountApiError(403,'The server did not authorize this request.');
  throw new AccountApiError(response.status,'The account service is unavailable or could not complete the request.');
 }
 return response;
}
async function json(response:Response):Promise<unknown>{
 if(!(response.headers.get('content-type')||'').toLowerCase().includes('application/json'))return invalid();
 try{return await response.json() as unknown;}catch{return invalid();}
}
const csrf=(session:SyntheticSession)=>({'X-CSRF-Token':session.csrf_token});
export async function accountStatus(signal?:AbortSignal):Promise<AccountServiceStatus>{return parseStatus(await json(await call('/status',{signal})));}
export async function accountSession(signal?:AbortSignal):Promise<SyntheticSession|null>{
 try{return parseSession(await json(await call('/session',{signal})));}
 catch(error){if(error instanceof AccountApiError&&error.status===401)return null;throw error;}
}
export async function updateSyntheticProfile(session:SyntheticSession, language:LanguageCode, professional_category:ProfessionalCategory|null):Promise<SyntheticProfile>{
 return parseProfile(await json(await call('/profile',{method:'PATCH',headers:{'Content-Type':'application/json',...csrf(session)},body:JSON.stringify({language,professional_category})})));
}
export async function signOutSynthetic(session:SyntheticSession):Promise<void>{await call('/logout',{method:'POST',headers:csrf(session)});}
export async function syntheticResources(signal?:AbortSignal):Promise<SyntheticResource[]>{return parseResources(await json(await call('/resources',{signal})));}
export async function syntheticGrants(signal?:AbortSignal):Promise<SyntheticGrant[]>{return parseGrants(await json(await call('/consents',{signal})));}
export async function createSyntheticResource(session:SyntheticSession):Promise<void>{
 const value=await json(await call('/resources',{method:'POST',headers:csrf(session)}));
 if(!object(value)||!uuid(value.id)||value.classification!=='synthetic')return invalid();
}
export async function readSyntheticResource(id:string):Promise<string>{
 if(!uuid(id))return invalid();
 const value=await json(await call(`/resources/${encodeURIComponent(id)}`));
 if(!object(value)||value.id!==id||value.classification!=='synthetic'||typeof value.content!=='string'||value.content.length>500)return invalid();
 return value.content;
}
export async function withdrawSyntheticGrant(session:SyntheticSession,id:string):Promise<void>{
 if(!uuid(id))return invalid();
 await call(`/consents/${encodeURIComponent(id)}`,{method:'DELETE',headers:csrf(session)});
}
/** Only starts a provider flow. A profile type is not authentication and never
 * confers verification or an administrator role. */
export function startProviderFlow(action:'login'|'register'|'recovery', kind:'patient'|'professional'='patient'):void{
 const query=action==='recovery'?'':`?kind=${encodeURIComponent(kind)}`;
 window.location.assign(`/api/identity/${action}${query}`);
}
