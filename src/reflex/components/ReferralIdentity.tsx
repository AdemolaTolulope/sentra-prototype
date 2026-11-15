import { Download, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { DemoFacility } from '../../geoaccess/data/types';
import { syntheticReferralSummary } from '../engine/identity';
import type { Referral } from '../types';

export function ReferralIdentity({referral,facilities}:{referral:Referral;facilities:DemoFacility[]}) {
 const download=()=>{
  const text=syntheticReferralSummary(referral,facilities);
  const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=`${referral.id}-synthetic-summary.txt`;anchor.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <section className="rf-identity" aria-label="Synthetic referral identification">
  <div className="rf-identity-code"><QRCodeSVG value={referral.id} size={88} level="M" marginSize={2} bgColor="#ffffff" fgColor="#0b1b12" role="img" aria-label={`QR code containing only synthetic referral ID ${referral.id}`}/></div>
  <div><span className="rf-overline"><QrCode size={12}/> SYNTHETIC IDENTIFICATION</span><strong>{referral.id}</strong><p>QR contains only this fictional referral ID. It is not a secure token, credential or link to a shared record.</p><button type="button" className="rf-secondary" onClick={download}><Download size={13}/> Download synthetic summary</button><small>Text download omits administrative notes; nothing is sent to a facility.</small></div>
 </section>;
}
