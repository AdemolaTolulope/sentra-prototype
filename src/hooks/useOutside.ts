import { useEffect, type RefObject } from 'react';
export function useOutside(ref: RefObject<HTMLElement | null>, open: boolean, close: ()=>void) {
  useEffect(()=>{if(!open) return; const onPointer=(e:MouseEvent)=>{if(ref.current && !ref.current.contains(e.target as Node)) close();}; const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape') close();}; document.addEventListener('mousedown',onPointer); document.addEventListener('keydown',onKey); return ()=>{document.removeEventListener('mousedown',onPointer);document.removeEventListener('keydown',onKey);};},[open,ref,close]);
}
