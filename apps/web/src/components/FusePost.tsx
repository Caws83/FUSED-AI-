"use client";

import { useState } from "react";
import { Button } from "@fused-ai/ui";

export type FusedDraft = {
  name: string;
  ticker: string;
  description: string;
  logoPrompt: string;
  imageId: string | null;
  imageUrl: string | null;
  imageError: string | null;
};

export function FusePost({
  disabled = false,
  onBusy,
  onFused,
}: {
  disabled?: boolean;
  onBusy?: (busy: boolean) => void;
  onFused: (draft: FusedDraft) => void;
}) {
  const [text, setText] = useState("");
  const [fusing, setFusing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFuse() {
    if (fusing || disabled) return;
    setError(null);
    const pasted = text.trim();
    if (pasted.length < 8) {
      setError("Paste a post with at least 8 characters.");
      return;
    }
    setFusing(true);
    onBusy?.(true);
    try {
      const res = await fetch("/api/ai/fuse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: pasted }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        draft?: { name: string; ticker: string; description: string; logoPrompt: string };
        image?: { id?: string; url?: string } | null;
        imageError?: string | null;
        error?: string;
      };
      if (!json.ok || !json.draft) {
        setError(json.error || "AI draft is not configured.");
        return;
      }
      onFused({
        name: json.draft.name,
        ticker: json.draft.ticker,
        description: json.draft.description,
        logoPrompt: json.draft.logoPrompt,
        imageId: json.image?.id ?? null,
        imageUrl: json.image?.url ?? null,
        imageError: json.imageError ?? null,
      });
    } catch {
      setError("AI draft failed.");
    } finally {
      setFusing(false);
      onBusy?.(false);
    }
  }

  return (
    <section className="fused-fuse-panel" data-fuse-panel>
      <p className="fused-kicker">Fuse a Post</p>
      <h2 className="fused-h2" style={{ fontSize: 24, margin: 0 }}>
        Paste a post
      </h2>
      <p style={{ margin: 0, color: "var(--fused-muted)" }}>
        Paste the text. FUSED drafts a name, ticker, description, and logo. You review everything. Nothing launches until
        you click Launch Token.
      </p>
      <label>
        Post text
        <textarea
          className="fused-input"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a tweet or post here"
          disabled={fusing || disabled}
          maxLength={2000}
        />
      </label>
      <Button type="button" variant="lime" onClick={() => void onFuse()} disabled={fusing || disabled}>
        {fusing ? "Fusing..." : "FUSE IT"}
      </Button>
      {error ? <p className="fused-form-error">{error}</p> : null}
    </section>
  );
}
