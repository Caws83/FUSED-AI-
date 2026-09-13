"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@fused-ai/ui";
import { FUSE_HANDOFF_MIN, writeFuseHandoff } from "../lib/fuse-handoff.ts";

export function QuickFuse() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const pasted = text.trim();
    if (pasted.length < FUSE_HANDOFF_MIN) {
      setNotice("Paste a post with at least 8 characters.");
      return;
    }
    if (!writeFuseHandoff(pasted)) {
      setNotice("Paste a post with at least 8 characters.");
      return;
    }
    router.push("/launch");
  }

  return (
    <form onSubmit={onSubmit} className="fused-fuse-stack">
      <div className="fused-fuse-box">
        <textarea
          name="postText"
          rows={4}
          placeholder="Paste a tweet or post here"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          aria-label="Paste a tweet or post here"
        />
        <Button type="submit" variant="lime" size="lg">
          FUSE IT
        </Button>
      </div>
      {notice ? <p className="fused-form-error">{notice}</p> : null}
    </form>
  );
}
