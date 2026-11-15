export const ROUTES = ['overview','community','clinical','operations','sentra-ai','account','professional-onboarding','care-reports','telemedicine','emergency','geoaccess','reflex','mama-guard','medilens','sentinel','community-insights','data-observatory','spatial-intelligence','predictive-analytics','settings','administration','about'] as const;
export type Route = typeof ROUTES[number];
export function currentRoute(): Route { const part = window.location.hash.replace(/^#\/?/,'').split('?')[0]; return (ROUTES as readonly string[]).includes(part) ? part as Route : 'overview'; }
export function navigate(route: Route) { if(currentRoute()===route) { window.scrollTo({top:0,behavior:'smooth'}); return; } window.location.hash = `/${route}`; }
