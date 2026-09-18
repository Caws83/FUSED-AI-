export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="fused-empty" role="status">
      <span className="fused-empty-icon" aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="7.5" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="32" cy="14" r="3.2" fill="currentColor" />
          <circle cx="50" cy="24" r="3.2" fill="currentColor" />
          <circle cx="50" cy="42" r="3.2" fill="currentColor" />
          <circle cx="32" cy="50" r="3.2" fill="currentColor" />
          <circle cx="14" cy="42" r="3.2" fill="currentColor" />
          <circle cx="14" cy="24" r="3.2" fill="currentColor" />
          <path
            d="M32 24.5V17.2M44.2 27.2 47.8 25.2M44.2 36.8 47.8 38.8M32 39.5v7.3M19.8 36.8 16.2 38.8M19.8 27.2 16.2 25.2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M28.5 30.5h7M30 33.5h4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}
