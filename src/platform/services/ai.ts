import type { LanguageCode } from '../language';
import { ServiceUnavailable, type IdentityAdapter, type PermissionAdapter } from './identity';

/** Provider-neutral boundaries, not an implementation of clinical AI.
 * Real adapters belong behind an authenticated, authorised backend. */
export type ProvenanceClass='VERIFIED'|'SYNTHETIC'|'ESTIMATED'|'SIMULATED'|'UNVERIFIED';
export interface EvidenceSource {id:string;title:string;url:string|null;classification:ProvenanceClass;reviewedAt:string|null}
export interface AssistantTurn {text:string;language:LanguageCode;conversationId:string}
export type SafetyResult={level:'emergency';message:string}|{level:'clear-to-continue'}|{level:'uncertain';message:string};
export interface IntakeAdapter {next(turn:AssistantTurn):Promise<{prompt:string}>}
export interface EvidenceAdapter {retrieve(query:string,language:LanguageCode):Promise<EvidenceSource[]>}
export interface SafetyAdapter {screen(turn:AssistantTurn):Promise<SafetyResult>}
export interface LanguageAdapter {translate(text:string,from:LanguageCode,to:LanguageCode):Promise<string>}
export interface SpeechAdapter {transcribe(audio:Blob,language:LanguageCode):Promise<string>;synthesise(text:string,language:LanguageCode):Promise<Blob>}
export interface NavigationAdapter {findOptions(context:unknown):Promise<unknown[]>}
export interface AssessmentAdapter {prepare(context:unknown,evidence:EvidenceSource[]):Promise<unknown>}
export interface ReportingAdapter {prepare(assessment:unknown):Promise<unknown>}
export interface FollowUpAdapter {plan(context:unknown):Promise<unknown>}
export interface AssistantAdapters {
 identity:IdentityAdapter;permissions:PermissionAdapter;safety:SafetyAdapter;intake:IntakeAdapter;evidence:EvidenceAdapter;
 language:LanguageAdapter;speech:SpeechAdapter;navigation:NavigationAdapter;assessment:AssessmentAdapter;reporting:ReportingAdapter;followUp:FollowUpAdapter;
}
export type TurnResult={kind:'interrupted';level:'emergency'|'uncertain';message:string}|{kind:'question';prompt:string};
/** Order is intentional: a failed/uncertain safety check must never continue
 * routine intake. UI checks alone do not enforce backend authorisation. */
export async function handleAssistantTurn(adapters:AssistantAdapters,turn:AssistantTurn):Promise<TurnResult>{
 const session=await adapters.identity.getSession();
 if(session.status!=='authenticated')throw new ServiceUnavailable('Authenticated access is required.');
 const permission=await adapters.permissions.check('assistant:interact',null);
 if(!permission.allowed)throw new ServiceUnavailable(permission.reason);
 const safety=await adapters.safety.screen(turn);
 if(safety.level!=='clear-to-continue')return {kind:'interrupted',level:safety.level,message:safety.message};
 const next=await adapters.intake.next(turn);
 return {kind:'question',prompt:next.prompt};
}
const unavailable=async ():Promise<never>=>{throw new ServiceUnavailable('This service has no configured provider.');};
export const unconfiguredAiServices={
 intake:{next:unavailable}, evidence:{retrieve:unavailable}, safety:{screen:unavailable},
 language:{translate:unavailable},speech:{transcribe:unavailable,synthesise:unavailable},
 navigation:{findOptions:unavailable},assessment:{prepare:unavailable},reporting:{prepare:unavailable},followUp:{plan:unavailable},
} satisfies Omit<AssistantAdapters,'identity'|'permissions'>;
