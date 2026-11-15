import { createContext, useContext } from 'react';
import type { WorkspaceState } from '../hooks/useWorkspace';
import type { Route } from '../services/route';
export interface WorkspaceContextValue {
  state: WorkspaceState;
  update: (patch: Partial<WorkspaceState>)=>void;
  reset: ()=>void;
  route: Route;
  go: (route:Route)=>void;
  showProject: ()=>void;
}
export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
export function useWorkspaceContext() { const context=useContext(WorkspaceContext); if(!context) throw new Error('Workspace context missing'); return context; }
