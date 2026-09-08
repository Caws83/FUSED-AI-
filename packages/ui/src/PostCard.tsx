import { Button } from "./Button.tsx";

export type PostCardProps = {
  author: string;
  username: string;
  text: string;
  timestamp: string;
  engagement: string;
  mediaUrl?: string;
  fuseDisabled?: boolean;
  fuseLabel?: string;
  onFuse?: () => void;
};

export function PostCard({
  author,
  username,
  text,
  timestamp,
  engagement,
  mediaUrl,
  fuseDisabled = true,
  fuseLabel = "Fuse",
  onFuse,
}: PostCardProps) {
  return (
    <article className="fused-card fused-post">
      <div className="fused-post-meta">
        <strong>
          {author} <span style={{ color: "var(--fused-muted)", fontWeight: 500 }}>@{username}</span>
        </strong>
        <time dateTime={timestamp}>{timestamp}</time>
      </div>
      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{text}</p>
      {mediaUrl ? <img src={mediaUrl} alt="" style={{ width: "100%", borderRadius: 16 }} /> : null}
      <div className="fused-post-meta">
        <span>{engagement}</span>
        <Button type="button" variant="lime" disabled={fuseDisabled} onClick={onFuse}>
          {fuseLabel}
        </Button>
      </div>
    </article>
  );
}
