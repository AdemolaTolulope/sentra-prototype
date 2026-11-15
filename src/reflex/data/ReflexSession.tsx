import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { emptyFilters } from '../engine/analytics';
import type { ReferralFilters, ReferralForm } from '../types';

interface Session {
  form: ReferralForm | null; setForm: Dispatch<SetStateAction<ReferralForm | null>>;
  editingId: string; setEditingId: Dispatch<SetStateAction<string>>;
  selectedId: string; setSelectedId: Dispatch<SetStateAction<string>>;
  filters: ReferralFilters; setFilters: Dispatch<SetStateAction<ReferralFilters>>;
  fromMama: boolean; setFromMama: Dispatch<SetStateAction<boolean>>;
}
const Context = createContext<Session | null>(null);
/** Keeps unsaved synthetic form and selection state in memory while the user
 * inspects GEOACCESS. Reloading or closing the tab discards this session. */
export function ReflexSessionProvider({children}:{children:ReactNode}) {
  const [form,setForm]=useState<ReferralForm|null>(null),[editingId,setEditingId]=useState(''),[selectedId,setSelectedId]=useState('');
  const [filters,setFilters]=useState<ReferralFilters>(emptyFilters),[fromMama,setFromMama]=useState(false);
  return <Context.Provider value={{form,setForm,editingId,setEditingId,selectedId,setSelectedId,filters,setFilters,fromMama,setFromMama}}>{children}</Context.Provider>;
}
export function useReflexSession():Session {const value=useContext(Context);if(!value)throw new Error('REFLEX session context is missing.');return value;}
