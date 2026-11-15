import { curveMonotoneX, line } from 'd3';
export function Sparkline({index=0,color='#46a977'}:{index?:number;color?:string}) {
  const values=Array.from({length:10},(_,i)=>14-Math.sin((i+index)*.8)*2.2-i*.75+(i===5?2.5:0)+(index%3));
  const shape=line<number>().x((_,i)=>i*7.6).y(d=>d).curve(curveMonotoneX)(values) || '';
  return <svg viewBox="0 0 70 22" className="sparkline" aria-label="Illustrative sparkline"><path d={shape} fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round"/><circle cx="68.4" cy={values[9]} r="2" fill={color}/></svg>;
}
