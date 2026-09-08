type Tone = "dark" | "light";
type Variant = "mark" | "wordmark" | "horizontal";

function Mark({ tone }: { tone: Tone }) {
  const lime = "#C8F54A";
  const blue = "#1F6FFF";
  const ink = tone === "light" ? "#FFFFFF" : "#071422";
  return (
    <svg viewBox="0 0 64 64" className="fused-logo-mark" aria-hidden="true">
      <path d="M10 50C18 38 22 30 32 24" fill="none" stroke={lime} strokeWidth="7" strokeLinecap="round" />
      <path d="M54 50C46 38 42 30 32 24" fill="none" stroke={blue} strokeWidth="7" strokeLinecap="round" />
      <path d="M32 6L34.4 16.2 45 14.2 36.6 22.2 43 32 32 26.4 21 32 27.4 22.2 19 14.2 29.6 16.2Z" fill={lime} />
      <circle cx="32" cy="24" r="5.5" fill={ink} />
      <circle cx="32" cy="24" r="2.6" fill={blue} />
    </svg>
  );
}

export function FusedLogo({
  variant = "horizontal",
  tone = "dark",
  className = "",
}: {
  variant?: Variant;
  tone?: Tone;
  className?: string;
}) {
  const color = tone === "light" ? "#FFFFFF" : "#071422";
  return (
    <span className={`fused-brand fused-brand-${variant} ${className}`.trim()} data-tone={tone}>
      <Mark tone={tone} />
      {variant !== "mark" ? (
        <span className="fused-brand-word" style={{ color }}>
          FUSED AI
        </span>
      ) : (
        <span className="fused-sr-only">FUSED AI</span>
      )}
    </span>
  );
}
