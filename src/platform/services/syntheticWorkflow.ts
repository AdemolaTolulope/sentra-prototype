/** Fixed copy, not generated and not a consultation. No free-form input. */
export type SyntheticScenario='navigation'|'emergency';
export interface SyntheticStep {stage:string;title:string;body:string;kind:'normal'|'safety';blocked?:string}
export const syntheticWorkflows:Record<SyntheticScenario,readonly SyntheticStep[]>={
 navigation:[
  {stage:'01 · INTAKE BOUNDARY',title:'A scripted starting point',body:'A future intake service could organise a request after authenticated access. This preview collects no symptoms or other patient information.',kind:'normal'},
  {stage:'02 · EVIDENCE BOUNDARY',title:'Evidence is not connected',body:'An approved retrieval service would need reviewed sources and traceable citations. None are retrieved or presented in this example.',kind:'normal'},
  {stage:'03 · CARE NAVIGATION',title:'No action is carried out',body:'A future service could support navigation and an explicitly consented report. This example creates no report, referral or appointment.',kind:'normal'},
 ],
 emergency:[
  {stage:'01 · PRESET SCENARIO',title:'A simulated warning sign',body:'This fixed example represents a possible emergency warning sign. Nothing is typed, recorded or assessed.',kind:'normal'},
  {stage:'02 · SAFETY INTERRUPTION',title:'Stop the ordinary workflow',body:'In a real emergency, contact local emergency services or seek urgent in-person care. This prototype cannot call, dispatch help or check availability.',kind:'safety',blocked:'Routine questions, evidence retrieval and assessment do not continue in this scenario.'},
 ],
};
