// Flat stand-in for DESIGN.md's 3D ribbon: one grainy Electric Blue tube behind the wordmark.
const PATH = "M-40 380 C 180 120, 420 520, 640 260 S 1020 40, 1260 300";

export function Ribbon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1200 520"
      preserveAspectRatio="none"
      className="absolute inset-x-[-4%] top-[10%] -z-10 h-4/5 w-[108%]"
    >
      <filter id="ribbon-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} result="noise" />
        <feColorMatrix in="noise" type="saturate" values="0" />
        <feComposite in2="SourceGraphic" operator="in" />
        <feBlend in="SourceGraphic" mode="multiply" />
      </filter>
      <path d={PATH} stroke="#000" strokeWidth={92} fill="none" strokeLinecap="round" />
      <path
        d={PATH}
        stroke="var(--color-blue)"
        strokeWidth={90}
        fill="none"
        strokeLinecap="round"
        filter="url(#ribbon-grain)"
      />
    </svg>
  );
}
