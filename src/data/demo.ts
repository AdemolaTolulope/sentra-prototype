import rawMetrics from './sample-metrics.json';

export const FCT = 'Federal Capital Territory (FCT), Abuja';
export const NATIONAL = 'Nigeria';
export type SampleMetric = {
  region: string; access: number; facilities: number; communities: number; referrals: number;
  maternal: number; medicine: number; indicators: number;
  readiness: { services: number; medicines: number; diagnostics: number };
  center: number[]; bounds: number[];
};
export const SAMPLE_METRICS: SampleMetric[] = rawMetrics;
export const REGIONS = [NATIONAL, ...SAMPLE_METRICS.map(x => x.region).filter(x => x !== FCT).sort((a,b) => a.localeCompare(b)), FCT];
export const shortRegion = (region: string) => region === FCT ? 'FCT, Abuja' : region;
export const regionType = (region: string) => region === NATIONAL ? 'National' : region === FCT ? 'Federal Capital Territory' : 'State';
const sum = (rows: SampleMetric[], field: 'facilities' | 'communities' | 'referrals' | 'maternal' | 'medicine' | 'indicators') => rows.reduce((a, b) => a + b[field], 0);
const mean = (v: number[]) => v.reduce((a,b) => a+b, 0) / (v.length || 1);
export function getMetrics(region: string) {
  const rows = region === NATIONAL ? SAMPLE_METRICS : SAMPLE_METRICS.filter(x => x.region === region);
  return {
    facilities: sum(rows,'facilities'), communities: sum(rows,'communities'), referrals: sum(rows,'referrals'),
    maternal: sum(rows,'maternal'), medicine: sum(rows,'medicine'), indicators: sum(rows,'indicators'),
    access: Number(mean(rows.map(x => x.access)).toFixed(1)),
    readiness: {
      services: Math.round(mean(rows.map(x => x.readiness.services))),
      medicines: Math.round(mean(rows.map(x => x.readiness.medicines))),
      diagnostics: Math.round(mean(rows.map(x => x.readiness.diagnostics))),
    },
    areas: rows.length,
  };
}
export function getDistribution(region: string) {
  const rows = region === NATIONAL ? SAMPLE_METRICS : SAMPLE_METRICS.filter(x => x.region === region);
  return [
    { name: 'Higher access', range: '70–100', count: rows.filter(x => x.access >= 70).length, color: '#16865b' },
    { name: 'Moderate access', range: '55–69', count: rows.filter(x => x.access >= 55 && x.access < 70).length, color: '#78bd98' },
    { name: 'Lower access', range: '0–54', count: rows.filter(x => x.access < 55).length, color: '#d6ebe0' },
  ];
}
export type Period = '3 months' | '6 months' | '12 months';
// Fixed illustrative trend coefficients, never real or model-generated observations.
export function getTrend(region: string, period: Period) {
  const m = getMetrics(region);
  const n = period === '3 months' ? 3 : period === '12 months' ? 12 : 6;
  const factors = [0.61,0.68,0.64,0.74,0.70,0.79,0.75,0.85,0.81,0.89,0.86,0.96];
  const now = new Date();
  return Array.from({length: n}, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    const factor = factors[12 - n + i];
    return {
      month: new Intl.DateTimeFormat('en', {month:'short'}).format(date),
      referrals: Math.round((m.referrals / 5.5) * factor),
      followups: Math.round((m.maternal / 4) * (factor + (i % 2 ? 0.08 : -0.03))),
      reports: Math.round((m.medicine / 5) * (factor + .08)),
    };
  });
}
export type DemoAlert = {
  id: string; title: string; description: string; severity: 'Moderate' | 'Low' | 'High';
  region: string; module: 'REFLEX' | 'GEOACCESS' | 'MAMA-GUARD' | 'MEDILENS' | 'SENTINEL'; time: string;
};
export const ALERTS: DemoAlert[] = [
  { id:'al-01', title:'Referral delay scenario', description:'A fictional referral pathway exceeded its sample review threshold. No real referral is represented.', severity:'High', region:'Ondo', module:'REFLEX', time:'09:42' },
  { id:'al-02', title:'Medicine report discrepancy', description:'A simulated availability report is awaiting a data-quality review. This is not a real shortage.', severity:'Moderate', region:'Kaduna', module:'MEDILENS', time:'08:15' },
  { id:'al-03', title:'Follow-up coverage review', description:'A demonstration maternal follow-up indicator is below an illustrative threshold.', severity:'Moderate', region:FCT, module:'MAMA-GUARD', time:'Yesterday, 16:20' },
  { id:'al-04', title:'Accessibility gap scenario', description:'An illustrative area has been flagged for access review. This does not identify an actual underserved community.', severity:'Low', region:'Cross River', module:'GEOACCESS', time:'Yesterday, 13:05' },
  { id:'al-05', title:'Indicator change to review', description:'An entirely simulated public-health indicator changed in the sample scenario. This is not an emergency.', severity:'Low', region:'Lagos', module:'SENTINEL', time:'Yesterday, 10:30' },
];
export const sampleProvenance = {
  source:'senTRA synthetic demonstration generator', observedAt:null, geographicCoverage:'Nigeria — state/FCT level',
  classification:'synthetic' as const, verification:'synthetic' as const,
  limitations:'Fictional values and randomly placed markers. Not measured, verified, clinically validated or suitable for decisions.',
};
/** Two fictional community examples per administrative area. Scores are arbitrary
 * offsets from already-random area scores, not geographic accessibility estimates. */
export function getCommunityIndicators(region: string) {
  return SAMPLE_METRICS.flatMap((area, i) => [0,1].map(j => ({
    id:`COMMUNITY-${String(i+1).padStart(2,'0')}-${String(j+1).padStart(2,'0')}`,
    region:area.region,
    accessibility:Math.max(0,Math.min(100,area.access + (j===0?-7:6) + ((i%3)-1)*2)),
  }))).filter(item=>region===NATIONAL || item.region===region);
}
