// Two strands twisting around each other: the Twyne mark.
export default function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 16C9 5 14 5 16 16S23 27 28 16" fill="none" stroke="#0B7A75" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M4 16C9 27 14 27 16 16S23 5 28 16" fill="none" stroke="#F2A33A" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}
