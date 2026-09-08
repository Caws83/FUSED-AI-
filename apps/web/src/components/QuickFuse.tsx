"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@fused-ai/ui";
import { AVAILABILITY_STATUS } from "@fused-ai/types";

export function QuickFuse({ socialStatus }: { socialStatus: string }) {
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (socialStatus !== AVAILABILITY_STATUS.OK) {
      setNotice("Social provider not configured.");
      return;
    }
    setNotice("Social provider credentials are present, but live post fetch is not implemented. No post data was loaded.");
  }

  return (
    <form onSubmit={onSubmit}>
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
          FUSE POST
        </Button>
      </div>
      {notice ? (
        <p role="status" style={{ margin: "12px 4px 0", color: "var(--fused-muted)" }}>
          {notice}
        </p>
      ) : null}
    </form>
  );
}
