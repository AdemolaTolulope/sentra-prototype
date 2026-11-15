export function BrandMark({size=37}:{size?:number}) {
  return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <rect x=".5" y=".5" width="39" height="39" rx="11" fill="#123D2C" />
    <path d="M20 6.8 31.1 13v14L20 33.2 8.9 27V13L20 6.8Z" stroke="#75CFA2" strokeWidth="1.4" />
    <path d="M20 12.5v15M12.5 20h15" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="20" cy="20" r="3.2" fill="#67CFA0" stroke="#123D2C" strokeWidth="1.15" />
  </svg>;
}
export function Wordmark() { return <div className="brand-wordmark"><div><span>sen</span><strong>TRA</strong></div><small>HEALTH INTELLIGENCE</small></div>; }
