import { useEffect, useState } from 'react';
import { ArrowRight, Check, FileLock2, Languages, LockKeyhole, LogOut, ShieldAlert, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { useWorkspaceContext } from '../components/WorkspaceContext';
import { LANGUAGES, type LanguageCode } from './language';
import { professionalCategories, type ProfessionalCategory } from './services/professional';
import {
 AccountApiError, accountSession, accountStatus, createSyntheticResource, readSyntheticResource,
 signOutSynthetic, startProviderFlow, syntheticGrants, syntheticResources, updateSyntheticProfile,
 withdrawSyntheticGrant, type AccountServiceStatus, type SyntheticGrant, type SyntheticResource, type SyntheticSession,
} from './services/syntheticAccount';
import { PlatformFooter, PlatformHead as Head } from './components/PlatformPrimitives';

export default function AccountWorkspace(){
 const {state,update,go}=useWorkspaceContext();
 const [status,setStatus]=useState<AccountServiceStatus|null>(null);
 const [session,setSession]=useState<SyntheticSession|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [language,setLanguage]=useState<LanguageCode>('en');
 const [category,setCategory]=useState<ProfessionalCategory|''>('');
 const [resources,setResources]=useState<SyntheticResource[]>([]);
 const [grants,setGrants]=useState<SyntheticGrant[]>([]);
 const [example,setExample]=useState('');

 useEffect(()=>{
  const controller=new AbortController();
  async function load(){
   try{
    const current=await accountStatus(controller.signal);
    if(controller.signal.aborted)return;
    setStatus(current);
    const signedIn=current.storage==='synthetic-local'&&current.sign_in_configured?await accountSession(controller.signal):null;
    if(controller.signal.aborted)return;
    setSession(signedIn);
    if(signedIn){
     setLanguage(signedIn.profile.language);setCategory(signedIn.profile.professional_category??'');
     if(signedIn.profile.role==='patient'){
      try{
       const [items,consents]=await Promise.all([syntheticResources(controller.signal),syntheticGrants(controller.signal)]);
       if(!controller.signal.aborted){setResources(items);setGrants(consents);}
      }catch(error){if(!controller.signal.aborted)setNotice(error instanceof AccountApiError?error.message:'Synthetic examples could not be loaded.');}
     }
    }
   }catch(error){if(!controller.signal.aborted)setNotice(error instanceof AccountApiError?error.message:'The account backend is unavailable.');}
   finally{if(!controller.signal.aborted)setLoading(false);}
  }
  void load();return()=>controller.abort();
 },[]);

 const handleError=(error:unknown)=>{
  if(error instanceof AccountApiError&&error.status===401){setSession(null);setResources([]);setGrants([]);setExample('');}
  setNotice(error instanceof AccountApiError?error.message:'The synthetic account request could not be completed.');
 };
 const refreshExamples=async()=>{const [items,consents]=await Promise.all([syntheticResources(),syntheticGrants()]);setResources(items);setGrants(consents);};
 const saveProfile=async()=>{
  if(!session)return;setBusy(true);setNotice('');
  try{const profile=await updateSyntheticProfile(session,language,category||null);setSession({...session,profile});setNotice('Synthetic account profile saved. No professional verification was performed.');}
  catch(error){handleError(error);}finally{setBusy(false);}
 };
 const logout=async()=>{
  if(!session)return;setBusy(true);setNotice('');
  try{await signOutSynthetic(session);setSession(null);setResources([]);setGrants([]);setExample('');setNotice('Local app session ended. The identity provider may still have its own session.');}
  catch(error){handleError(error);}finally{setBusy(false);}
 };
 const createExample=async()=>{
  if(!session)return;setBusy(true);setNotice('');
  try{await createSyntheticResource(session);await refreshExamples();setNotice('Fixed synthetic example created. No patient information was collected.');}
  catch(error){handleError(error);}finally{setBusy(false);}
 };
 const showExample=async(id:string)=>{
  setBusy(true);setNotice('');
  try{setExample(await readSyntheticResource(id));}catch(error){handleError(error);}finally{setBusy(false);}
 };
 const withdraw=async(id:string)=>{
  if(!session)return;setBusy(true);setNotice('');
  try{await withdrawSyntheticGrant(session,id);await refreshExamples();setNotice('Synthetic consent withdrawn. Future reads require another valid grant.');}
  catch(error){handleError(error);}finally{setBusy(false);}
 };
 const providerLabel=loading?'CHECKING':session?'SYNTHETIC SESSION':status?.sign_in_configured?'CONFIGURED · NOT VERIFIED':status?'NOT CONFIGURED':'BACKEND UNAVAILABLE';
 const backendLabel=!status?'Not reachable':status.storage==='synthetic-local'?'Synthetic local store':'Disabled';
 const identityLabel=!status?'Unknown':status.sign_in_configured?'Configured; provider not verified':'Not configured';

 return <div className="page-content sp-page">
  <Head eyebrow="IDENTITY & ACCESS" stage="MILESTONE 1" title="Your account. Your choices." description="A synthetic-only foundation for server sessions, account preferences and consent boundaries across senTRA."/>
  <div className="sp-boundary"><ShieldAlert size={16}/><p><strong>Synthetic development only.</strong> Do not enter real patient or professional information. This is not an operational healthcare service; the existing workspaces are not protected by these account examples.</p><span>NO REAL DATA</span></div>
  {notice&&<div className="sp-account-notice" role="status">{notice}</div>}
  <div className="sp-account-panels">
   <section className="sp-panel sp-section-panel"><div className="sp-panel-heading"><div><span className="sp-icon"><UserRound size={18}/></span><h2>Account access</h2></div><span className="sp-tag sp-tag-gold">{providerLabel}</span></div>
    {session?<>
     <p>Signed in to a <strong>synthetic-only</strong> server session. The provider authenticates; workspace navigation does not grant permission.</p>
     <div className="sp-account-facts"><div><span>PROFILE TYPE</span><strong>{session.profile.role}</strong></div><div><span>VERIFICATION</span><strong>{session.profile.verification==='verified'?'Synthetic verified · test context only':session.profile.verification}</strong></div><div className="sp-account-id"><span>SYNTHETIC ACCOUNT ID</span><strong>{session.profile.id}</strong></div></div>
     <div className="sp-account-profile-form">
      <label className="sp-field">Account language<select value={language} onChange={e=>setLanguage(e.target.value as LanguageCode)}>{LANGUAGES.map(item=><option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
      {session.profile.role==='professional'&&<label className="sp-field">Synthetic professional category<select value={category} onChange={e=>setCategory(e.target.value as ProfessionalCategory|'')}><option value="">Not selected</option>{professionalCategories.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>}
     </div>
     <div className="sp-account-actions"><button className="sp-primary" disabled={busy} onClick={()=>void saveProfile()}>Save synthetic profile</button><button className="sp-quiet" disabled={busy} onClick={()=>void logout()}><LogOut size={14}/> Sign out</button></div>
     <p className="sp-mini-note">Session expires {new Date(session.expires_at*1000).toLocaleString()}. Sign-out ends the app session only; provider sign-out is not connected. Category selection does not verify a professional.</p>
    </>:<>
     <p>{status?.sign_in_configured?'A provider is configured but has not been independently verified. A provider flow is required to establish a server session.':'Sign-in, registration and recovery need an explicitly configured identity provider. No demo role selector can create a genuine session.'}</p>
     <div className="sp-account-actions"><button className="sp-primary" disabled={loading||!status?.sign_in_configured} onClick={()=>startProviderFlow('login')}><LockKeyhole size={14}/> Sign in</button><button className="sp-quiet" disabled={loading||!status?.registration_configured} onClick={()=>startProviderFlow('register')}>Create an account</button><button className="sp-quiet" disabled={loading||!status?.recovery_configured} onClick={()=>startProviderFlow('recovery')}>Recover account</button></div>
     <div className="sp-account-actions sp-secondary-actions"><button className="sp-quiet" disabled={loading||!status?.sign_in_configured} onClick={()=>startProviderFlow('login','professional')}>Professional sign in</button><button className="sp-quiet" disabled={loading||!status?.registration_configured} onClick={()=>startProviderFlow('register','professional')}>Professional registration</button></div>
     <p className="sp-mini-note">The buttons choose a synthetic profile type for first sign-in, not a privilege. Professional profiles start unverified; administrator and verified-clinician status cannot be self-assigned. This page collects no passwords or health details.</p>
    </>}
   </section>
   <section className="sp-panel sp-section-panel"><div className="sp-panel-heading"><div><span className="sp-icon"><Languages size={18}/></span><h2>Language preference</h2></div><span className="sp-tag">DISPLAY SETTING</span></div>
    <p>Choose a preference for future language services. This prototype remains in English; translation and speech are not connected or validated.</p>
    <label className="sp-field-label" htmlFor="preferred-language">Preferred language</label><select id="preferred-language" className="sp-select" value={state.language} onChange={e=>update({language:e.target.value as LanguageCode})}>{LANGUAGES.map(item=><option key={item.code} value={item.code}>{item.label}</option>)}</select>
    <p className="sp-mini-note">Saved locally as a display preference on this device. A synthetic account language, if available, is saved separately and is not automatically synchronised.</p>
    <div className="sp-service-status" aria-label="Identity service status"><div><span>Backend</span><strong>{backendLabel}</strong></div><div><span>Identity provider</span><strong>{identityLabel}</strong></div><div><span>Email verification gate</span><strong>{!status?.sign_in_configured?'Unavailable':status.email_verification_required?'Required · provider claim':'Not required'}</strong></div><div><span>Professional verification</span><strong>Not connected</strong></div><div><span>App email delivery</span><strong>Not connected</strong></div></div>
    <p className="sp-mini-note">On temporary or free cloud hosting, synthetic accounts and sessions can be lost when the service restarts. Never store real information in this demo.</p>
   </section>
  </div>
  <div className="sp-section-label"><span>ACCESS AND CONSENT MODEL</span><span>SYNTHETIC FOUNDATION · NO CLINICAL SHARING</span></div>
  <div className="sp-account-panels">
   <section className="sp-panel sp-section-panel"><div className="sp-panel-heading"><div><span className="sp-icon"><UsersRound size={18}/></span><h2>Role-aware workspaces</h2></div></div>
    <p>The account service checks server-owned roles and resource ownership for its fixed synthetic examples. Existing GEOACCESS, REFLEX and MAMA-GUARD demonstrations remain separate, synthetic workspaces; navigation is not authorisation.</p>
    <div className="sp-role-list"><span>Patient / community</span><span>Professional · unverified</span><span>Healthcare operations</span><span>Platform administrator</span></div>
    {session?.profile.role==='patient'&&<div className="sp-account-example"><strong>Fixed synthetic resources</strong><p>Create an empty example to exercise ownership checks. It cannot contain patient information.</p><button className="sp-quiet" disabled={busy} onClick={()=>void createExample()}>Create synthetic example</button>{resources.length===0?<small>No synthetic examples yet.</small>:<ul>{resources.map(item=><li key={item.id}><code>{item.id}</code><button className="sp-inline-link" disabled={busy} onClick={()=>void showExample(item.id)}>View fixed example</button></li>)}</ul>}{example&&<div className="sp-demo-result" role="status"><strong>SYNTHETIC EXAMPLE</strong><span>{example}</span></div>}</div>}
   </section>
   <section className="sp-panel sp-section-panel"><div className="sp-panel-heading"><div><span className="sp-icon"><FileLock2 size={18}/></span><h2>Consent-aware sharing</h2></div><span className="sp-tag">SYNTHETIC ONLY</span></div>
    <p>The backend can test recipient-, purpose- and resource-scoped consent and withdrawal for fixed examples. Reports, referrals and email are not connected to this service.</p>
    <ul className="sp-check-list"><li><Check size={14}/> Purpose and recipient made explicit</li><li><Check size={14}/> Synthetic grants can be withdrawn</li><li><Check size={14}/> Decisions recorded in a local restricted audit table</li></ul>
    {session?.profile.role==='patient'&&<div className="sp-account-example"><strong>Synthetic consent records</strong><p>A grant requires a synthetic professional marked verified in a trusted test fixture. No independent verification service is connected, so creating grants here is unavailable.</p><button className="sp-quiet" disabled>Create synthetic consent</button>{grants.length===0?<small>No synthetic consent records.</small>:<ul>{grants.map(grant=><li key={grant.id}><div><b>{grant.status.toUpperCase()}</b><small>Recipient: {grant.recipient_id}<br/>Resource: {grant.resource_id}<br/>Scope: {grant.scope} · Purpose: {grant.purpose}</small></div>{grant.status==='active'&&<button className="sp-quiet" disabled={busy} onClick={()=>void withdraw(grant.id)}>Withdraw synthetic consent</button>}</li>)}</ul>}</div>}
    <p className="sp-mini-note">Audit records are local and append-only in this prototype, not independently protected against a database owner. There is no public audit viewer or production audit service.</p>
   </section>
  </div>
  <section className="sp-inline-feature"><ShieldCheck size={20}/><div><strong>For healthcare professionals</strong><p>See the proposed onboarding and independent verification pathway. No applications are submitted here.</p></div><button className="sp-quiet" onClick={()=>go('professional-onboarding')}>Explore pathway <ArrowRight size={14}/></button></section>
  <PlatformFooter/>
 </div>;
}
