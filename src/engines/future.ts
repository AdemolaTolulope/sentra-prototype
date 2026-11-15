import type { Camera, Scene } from 'three';
import type { ExplainableResult, Facility } from '../types/domain';
/** Contracts only: none of these operations or a 3D digital twin are implemented in Stage 1. */
export interface FacilityCapabilityEngine { evaluate(facility:Facility): Promise<ExplainableResult<number>> }
export interface OptimisationEngine { match(criteria:unknown): Promise<ExplainableResult<Facility[]>> }
export interface EpidemiologyEngine { analyse(indicators:unknown[]): Promise<ExplainableResult<unknown>> }
export interface ProvenanceEngine { audit(recordId:string): Promise<unknown> }
export interface PredictiveEngine { predict(inputs:unknown): Promise<ExplainableResult<unknown>> }
export interface FutureThreeScene { scene:Scene; camera:Camera; dispose():void }
