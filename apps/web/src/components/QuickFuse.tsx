"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@fused-ai/ui";

export function QuickFuse({ ready }: { ready: boolean }) {
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    if (!ready) {
      setNotice("Launch from a post is temporarily unavailable.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/social/fuse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = (await res.json()) as { ok?: boolean; postId?: string; error?: string };
      if (!json.ok || !json.postId) {
        setNotice(json.error || "This post is not available right now.");
        return;
      }
      window.location.href = `/launch?post=${encodeURIComponent(json.postId)}`;
    } catch {
      setNotice("This post is not available right now.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="fused-fuse-stack">
      <div className="fused-fuse-box">
        <input
          type="url"
          name="postUrl"
          placeholder="Paste an X post URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          aria-label="Paste an X post URL"
        />
        <Button type="submit" variant="lime" size="lg" disabled={pending}>
          {pending ? "Checking…" : "FUSE IT"}
        </Button>
      </div>
      {notice ? (
        <p role="status" style={{ margin: 0, color: "var(--fused-muted)" }}>
          {notice}
        </p>
      ) : null}
    </form>
  );
}
