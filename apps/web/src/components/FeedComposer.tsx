"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { Button } from "@fused-ai/ui";
import { FUSED_FEED_TEXT_MAX } from "@fused-ai/validation";

export function FeedComposer() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isConnected || !address) {
    return <p className="fused-support">Connect your wallet to post.</p>;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const body = text.trim();
    if (!body) {
      setNotice("Write something before posting.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/social/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, text: body }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setNotice(payload.error || "Could not publish.");
        return;
      }
      setText("");
      router.refresh();
    } catch {
      setNotice("Could not publish.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="fused-fuse-stack fused-feed-composer">
      <div className="fused-fuse-box">
        <textarea
          name="feedText"
          rows={4}
          placeholder="What's happening?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={FUSED_FEED_TEXT_MAX}
          aria-label="What's happening?"
          disabled={busy}
        />
        <Button type="submit" variant="lime" size="lg" disabled={busy}>
          POST
        </Button>
      </div>
      {notice ? <p className="fused-form-error">{notice}</p> : null}
    </form>
  );
}
