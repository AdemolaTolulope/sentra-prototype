import { createContext, useContext } from 'react';
import { ALERTS, SAMPLE_METRICS, getCommunityIndicators, getDistribution, getMetrics, getTrend, sampleProvenance, type DemoAlert, type Period, type SampleMetric } from '../data/demo';
import type { DataProvenance } from '../types/domain';

/**
 * The UI consumes this provider contract, rather than fetching backend endpoints.
 * A future API adapter can load/normalise its records and provide the same shape
 * through context. Stage 1 deliberately ships only the local synthetic provider.
 */
export interface IntelligenceProvider {
  provenance: DataProvenance;
  areas(): SampleMetric[];
  alerts(): DemoAlert[];
  metrics(region:string): ReturnType<typeof getMetrics>;
  distribution(region:string): ReturnType<typeof getDistribution>;
  communityIndicators(region:string): ReturnType<typeof getCommunityIndicators>;
  trend(region:string, period:Period): ReturnType<typeof getTrend>;
  mapSources: { context:string; boundaries:string; nationalOutline:string; markers:string };
}
export const demoProvider: IntelligenceProvider = {
  provenance: sampleProvenance,
  areas: () => SAMPLE_METRICS,
  alerts: () => ALERTS,
  metrics: getMetrics,
  distribution: getDistribution,
  communityIndicators: getCommunityIndicators,
  trend: getTrend,
  mapSources: {context:'/data/west-africa-context.geojson',boundaries:'/data/nigeria-adm1.geojson',nationalOutline:'/data/nigeria-outline.geojson',markers:'/data/demo-markers.geojson'},
};
export const IntelligenceProviderContext = createContext<IntelligenceProvider>(demoProvider);
export function useIntelligenceData() { return useContext(IntelligenceProviderContext); }
