"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@fused-ai/ui";

export function QuickFuse({ ready }: { ready: boolean }) {
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) {
      setNotice("Fusing from a post is coming soon.");
      return;
    }
    setNotice("Fusing from a post is coming soon.");
  }

  return (
    <form onSubmit={onSubmit} className="fused-fuse-stack">
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
        <Button type="submit" variant="lime" size="lg">
          FUSE IT
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
