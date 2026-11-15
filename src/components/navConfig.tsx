import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, MapPinned, GitBranch, HeartPulse, Pill, Radar, UsersRound, Database, Layers3, ChartNoAxesCombined, Settings2, ShieldCheck, CircleHelp, Stethoscope, PanelsTopLeft, Sparkles, UserRound, BadgeCheck, FileHeart, Video, LifeBuoy } from 'lucide-react';
import type { Route } from '../services/route';
export interface NavItem { label:string; route:Route; icon:LucideIcon; description?:string }
export const NAV_GROUPS: {title:string; items:NavItem[]}[] = [
  { title:'PLATFORM WORKSPACES', items:[
    {label:'Community & Patient',route:'community',icon:UsersRound,description:'Patient-facing workspace preview'},
    {label:'Clinical Intelligence',route:'clinical',icon:Stethoscope,description:'Professional workspace preview'},
    {label:'Operations & Intelligence',route:'operations',icon:PanelsTopLeft,description:'Geographic and coordination tools'},
    {label:'senTRA AI',route:'sentra-ai',icon:Sparkles,description:'Registered-only assistant integration'},
    {label:'Account & Access',route:'account',icon:UserRound,description:'Identity and language settings'},
    {label:'Professional Pathway',route:'professional-onboarding',icon:BadgeCheck,description:'Verification process preview'},
    {label:'Care & Reports',route:'care-reports',icon:FileHeart,description:'Synthetic report and navigation'},
    {label:'Telemedicine',route:'telemedicine',icon:Video,description:'Consultation service boundary'},
    {label:'Emergency Health',route:'emergency',icon:LifeBuoy,description:'Civilian coordination foundation'},
  ]},
  { title:'FOUNDATION', items:[{label:'Overview',route:'overview',icon:LayoutDashboard}] },
  { title:'INTELLIGENCE MODULES', items:[
    {label:'GEOACCESS',route:'geoaccess',icon:MapPinned,description:'Geospatial intelligence'},
    {label:'REFLEX',route:'reflex',icon:GitBranch,description:'Referral intelligence'},
    {label:'MAMA-GUARD',route:'mama-guard',icon:HeartPulse,description:'Maternal and neonatal health'},
    {label:'MEDILENS',route:'medilens',icon:Pill,description:'Medicine and diagnostics'},
    {label:'SENTINEL',route:'sentinel',icon:Radar,description:'Public health surveillance'},
  ]},
  { title:'ADVANCED ANALYTICS', items:[
    {label:'Community Insights',route:'community-insights',icon:UsersRound},
    {label:'Data Observatory',route:'data-observatory',icon:Database},
    {label:'Spatial Intelligence',route:'spatial-intelligence',icon:Layers3},
    {label:'Predictive Analytics',route:'predictive-analytics',icon:ChartNoAxesCombined},
  ]},
  { title:'SYSTEM', items:[
    {label:'Settings',route:'settings',icon:Settings2},
    {label:'Administration',route:'administration',icon:ShieldCheck},
    {label:'About senTRA',route:'about',icon:CircleHelp},
  ]},
];
export const ALL_NAV = NAV_GROUPS.flatMap(group=>group.items);
