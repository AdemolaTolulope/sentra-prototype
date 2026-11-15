/** Design boundaries only. A server, not this UI, must validate sessions,
 * enforce permissions and check consent before releasing protected data. */
export type PlatformRole='patient'|'clinician'|'operations'|'administrator';
export type ProtectedAction='assistant:interact'|'report:read'|'report:share'|'appointment:request'|'referral:submit'|'clinical:document'|'emergency:coordinate';
export type IdentitySession =
 | {status:'unconfigured'|'unauthenticated'}
 | {status:'authenticated';subject:string;roles:PlatformRole[];expiresAt:string};
export type ConsentScope='assessment:share'|'referral:share'|'email:send';
export type ConsentState='not-recorded'|'granted'|'withdrawn';
export interface AccessDecision {allowed:boolean;reason:string}
export interface IdentityAdapter {
 getSession(signal?:AbortSignal):Promise<IdentitySession>;
 signIn():Promise<void>;
 register(role:PlatformRole):Promise<void>;
 signOut():Promise<void>;
}
export interface PermissionAdapter {check(action:ProtectedAction,resourceId:string|null):Promise<AccessDecision>}
export interface ConsentAdapter {get(scope:ConsentScope,subject:string,recipient:string|null):Promise<ConsentState>}
export class ServiceUnavailable extends Error {constructor(message:string){super(message);this.name='ServiceUnavailable';}}
/** Fail closed: there is no demo login or browser flag that creates a session. */
export const unconfiguredIdentity:IdentityAdapter={
 async getSession(){return {status:'unconfigured'};},
 async signIn(){throw new ServiceUnavailable('Authentication is not configured.');},
 async register(){throw new ServiceUnavailable('Account registration is not configured.');},
 async signOut(){},
};
export const unconfiguredPermissions:PermissionAdapter={async check(){return {allowed:false,reason:'Server-side authorisation is not configured.'};}};
export const unconfiguredConsent:ConsentAdapter={async get(){return 'not-recorded';}};
/** Client-side checks are display hints only, never a security boundary. */
export async function protectedAccess(action:ProtectedAction,resourceId:string|null=null):Promise<AccessDecision>{
 const session=await unconfiguredIdentity.getSession();
 if(session.status!=='authenticated')return {allowed:false,reason:'A genuine authenticated account is required.'};
 return unconfiguredPermissions.check(action,resourceId);
}
