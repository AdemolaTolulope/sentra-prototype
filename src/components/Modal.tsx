import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}) {
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape') onClose();};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[onClose]);
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
    <div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18}/></button></div>{children}
  </div></div>;
}
