import { Button } from "./Button.tsx";

export type PostCardProps = {
  author: string;
  username: string;
  displayName?: string;
  text: string;
  timestamp: string;
  engagement: string;
  avatarUrl?: string;
  verified?: boolean;
  mediaUrl?: string;
  fuseDisabled?: boolean;
  fuseLabel?: string;
  fuseHref?: string;
  onFuse?: () => void;
};

export function PostCard({
  author,
  username,
  displayName,
  text,
  timestamp,
  engagement,
  avatarUrl,
  verified = false,
  mediaUrl,
  fuseDisabled = true,
  fuseLabel = "FUSE IT",
  fuseHref,
  onFuse,
}: PostCardProps) {
  const nickname = displayName?.trim() ?? "";
  return (
    <article className="fused-card fused-post">
      <div className="fused-post-head">
        <div
          className="fused-avatar"
          style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
          aria-hidden="true"
        />
        <div className="fused-post-author">
          {nickname ? <strong>{nickname}</strong> : null}
          <span className="fused-post-subline">
            {nickname ? (
              author
            ) : (
              <>
                <strong>{author}</strong>
                {verified ? <span className="fused-verified" title="Verified">✓</span> : null}
                {username.trim() ? (
                  <>
                    {" "}
                    <span style={{ color: "var(--fused-muted)", fontWeight: 500 }}>@{username}</span>
                  </>
                ) : null}
              </>
            )}
            {" · "}
            <time dateTime={timestamp}>{timestamp}</time>
          </span>
        </div>
      </div>
      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{text}</p>
      {mediaUrl ? <img src={mediaUrl} alt="" style={{ width: "100%", borderRadius: 16 }} /> : null}
      <div className="fused-post-meta">
        <span>{engagement}</span>
        {fuseHref && !fuseDisabled ? (
          <a href={fuseHref} className="fused-btn fused-btn-lime">
            {fuseLabel}
          </a>
        ) : (
          <Button type="button" variant="lime" disabled={fuseDisabled} onClick={onFuse}>
            {fuseLabel}
          </Button>
        )}
      </div>
    </article>
  );
}
