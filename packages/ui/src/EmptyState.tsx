export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="fused-empty" role="status">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}
