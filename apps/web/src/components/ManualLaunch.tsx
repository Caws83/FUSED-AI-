"use client";

import { useMemo, useState } from "react";
import { useAccount, useChainId, useConfig, useSwitchChain } from "wagmi";
import { parseEther, parseEventLogs } from "viem";
import { Button, Card } from "@fused-ai/ui";
import {
  FUSED_ERROR_MESSAGES,
  FUSED_FACTORY_ABI,
  toCreateParams,
} from "@fused-ai/blockchain/fused";
import { validateLaunchForm } from "@fused-ai/blockchain/abi";
import type { SocialPost } from "@fused-ai/types";
import { chainLabelFor, writeClientError } from "../lib/wallet.ts";
import { resolveWriteClients } from "../lib/wallet-clients.ts";
import { FusePost, type FusedDraft } from "./FusePost.tsx";

type Step = "form" | "review" | "done";

export function ManualLaunch({
  factory,
  locker,
  chainId,
  chainName,
  ready,
  sourcePost = null,
}: {
  factory: `0x${string}` | null;
  locker: `0x${string}` | null;
  chainId: number | null;
  chainName: string;
  ready: boolean;
  sourcePost?: SocialPost | null;
}) {
  const { address, isConnected, connector } = useAccount();
  const walletChainId = useChainId();
  const config = useConfig();
  const { switchChain } = useSwitchChain();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [creatorBuy, setCreatorBuy] = useState("");
  const [imageId, setImageId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [generatingLogo, setGeneratingLogo] = useState(false);
  const [fusingPost, setFusingPost] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [token, setToken] = useState<`0x${string}` | null>(null);

  const wrongNetwork = Boolean(isConnected && chainId && walletChainId !== chainId);
  const params = useMemo(() => {
    return toCreateParams({ name, symbol, metadataURI: description });
  }, [name, symbol, description]);

  if (!ready || !factory) {
    return (
      <Card>
        <p style={{ margin: 0, color: "var(--fused-muted)" }}>Launch is temporarily unavailable.</p>
      </Card>
    );
  }

  function applyFusedDraft(draft: FusedDraft) {
    setName(draft.name);
    setSymbol(draft.ticker);
    setDescription(draft.description);
    setImagePrompt(draft.logoPrompt);
    setError(null);
    if (draft.imageId && draft.imageUrl) {
      setImageId(draft.imageId);
      setImagePreview(draft.imageUrl);
      setLogoError(null);
    } else {
      setLogoError(draft.imageError || "Logo generation failed. Upload a logo or retry.");
    }
  }

  async function onUpload(file: File | undefined) {
    setError(null);
    setLogoError(null);
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/media/upload", { method: "POST", body });
    const json = (await res.json()) as { ok?: boolean; id?: string; url?: string; error?: string };
    if (!json.ok || !json.id || !json.url) {
      setError(json.error || "Upload is temporarily unavailable.");
      return;
    }
    setImageId(json.id);
    setImagePreview(json.url);
  }

  async function onAiDraft() {
    setError(null);
    if (!sourcePost) return;
    setPending(true);
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId: sourcePost.postId }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        draft?: { name: string; ticker: string; description: string; imageConcept: string };
        error?: string;
      };
      if (!json.ok || !json.draft) {
        setError(json.error || "AI draft is temporarily unavailable.");
        return;
      }
      setName(json.draft.name);
      setSymbol(json.draft.ticker);
      setDescription(json.draft.description);
      setImagePrompt(json.draft.imageConcept);
    } catch {
      setError("AI draft is temporarily unavailable.");
    } finally {
      setPending(false);
    }
  }

  async function onAiImage() {
    if (generatingLogo || pending || fusingPost) return;
    setError(null);
    setLogoError(null);
    if (!name.trim() || !symbol.trim()) {
      setError("Name and ticker are required.");
      return;
    }
    setGeneratingLogo(true);
    try {
      const res = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, symbol, description, imagePrompt }),
      });
      const json = (await res.json()) as { ok?: boolean; id?: string; url?: string; error?: string };
      if (!json.ok || !json.id || !json.url) {
        setLogoError(json.error || "AI logo generation is not configured.");
        return;
      }
      setImageId(json.id);
      setImagePreview(json.url);
    } catch {
      setLogoError("AI logo generation failed.");
    } finally {
      setGeneratingLogo(false);
    }
  }

  async function onReview() {
    setError(null);
    const invalid = validateLaunchForm({ name, symbol, metadataURI: description });
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!isConnected || !address) {
      setError("Connect a wallet to continue.");
      return;
    }
    if (wrongNetwork && chainId) {
      try {
        await switchChain({ chainId });
      } catch {
        setError(`Switch your wallet to ${chainName}.`);
        return;
      }
    }
    setStep("review");
  }

  async function onLaunch() {
    setError(null);
    if (!isConnected || !address) {
      setError(writeClientError("account"));
      return;
    }
    if (!factory || !chainId) {
      setError("Launch is temporarily unavailable.");
      return;
    }
    if (walletChainId !== chainId) {
      try {
        await switchChain({ chainId });
      } catch {
        setError(writeClientError("chain"));
        return;
      }
    }
    setPending(true);
    try {
      const resolved = await resolveWriteClients(config, { chainId, account: address, connector });
      if (!resolved.ok) {
        setError(writeClientError(resolved.reason));
        return;
      }
      const { publicClient, walletClient } = resolved;
      const launchParams = toCreateParams({ name, symbol, metadataURI: description });
      const value = creatorBuy.trim() ? parseEther(creatorBuy) : 0n;
      const { request } = await publicClient.simulateContract({
        address: factory,
        abi: FUSED_FACTORY_ABI,
        functionName: "create",
        args: [launchParams],
        account: address,
        value,
      });
      const hash = await walletClient.writeContract(request);
      setTxHash(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        setError("The transaction did not succeed.");
        return;
      }
      const created = parseEventLogs({
        abi: FUSED_FACTORY_ABI,
        logs: receipt.logs,
        eventName: "Created",
      })[0];
      const launchedToken = created?.args.token;
      if (launchedToken) setToken(launchedToken);
      await fetch(`/api/launch/sync?tx=${hash}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageId,
          sourcePostId: sourcePost?.postId,
          description,
        }),
      });
      setStep("done");
    } catch (caught) {
      setError(humanError(caught));
    } finally {
      setPending(false);
    }
  }

  if (step === "done" && token && txHash) {
    return (
      <Card>
        <p className="fused-kicker">Live</p>
        <h2 className="fused-h2" style={{ fontSize: 28 }}>
          {name} is on the curve
        </h2>
        <p style={{ color: "var(--fused-muted)" }}>
          {symbol.toUpperCase()} is onchain. Buy and sell on the bonding curve until it graduates.
        </p>
        <p>
          <a href={`/token/${token}`}>Open token</a>
        </p>
        <p style={{ fontSize: 13, color: "var(--fused-muted)", wordBreak: "break-all" }}>{txHash}</p>
      </Card>
    );
  }

  if (step === "review" && params && address) {
    return (
      <Card>
        <p className="fused-kicker">Review</p>
        <h2 className="fused-h2" style={{ fontSize: 28 }}>
          Confirm launch
        </h2>
        {imagePreview ? (
          <img src={imagePreview} alt="" width={72} height={72} className="fused-logo-preview" />
        ) : null}
        <dl className="fused-review">
          <div>
            <dt>Token name</dt>
            <dd>{params.name}</dd>
          </div>
          <div>
            <dt>Ticker</dt>
            <dd>{params.symbol}</dd>
          </div>
          <div>
            <dt>Wallet</dt>
            <dd>
              {address.slice(0, 6)}…{address.slice(-4)}
            </dd>
          </div>
          <div>
            <dt>Chain</dt>
            <dd>
              {chainLabelFor(walletChainId) ?? chainName} ({walletChainId || chainId})
            </dd>
          </div>
          <div>
            <dt>Factory</dt>
            <dd style={{ wordBreak: "break-all" }}>{factory}</dd>
          </div>
          {locker ? (
            <div>
              <dt>Locker</dt>
              <dd style={{ wordBreak: "break-all" }}>{locker}</dd>
            </div>
          ) : null}
          <div>
            <dt>Quote</dt>
            <dd>ETH</dd>
          </div>
          <div>
            <dt>Lifecycle</dt>
            <dd>Bonding curve, then Uniswap at graduation</dd>
          </div>
          <div>
            <dt>Creator buy</dt>
            <dd>
              {creatorBuy.trim()
                ? `${creatorBuy} ETH through the same bonding curve`
                : "0 ETH — no creator buy. The curve starts with virtual reserves only."}
            </dd>
          </div>
          {sourcePost ? (
            <div>
              <dt>Origin post</dt>
              <dd>@{sourcePost.authorUsername}</dd>
            </div>
          ) : null}
          <div>
            <dt>Action</dt>
            <dd>FusedFactory.create</dd>
          </div>
        </dl>
        {error ? <p className="fused-form-error">{error}</p> : null}
        <div className="fused-cta-row">
          <Button type="button" variant="ghost" onClick={() => setStep("form")} disabled={pending}>
            Back
          </Button>
          <Button type="button" variant="lime" onClick={() => void onLaunch()} disabled={pending}>
            {pending ? "Launching…" : "LAUNCH TOKEN"}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {sourcePost ? <SourcePost post={sourcePost} /> : null}
      <FusePost disabled={pending} onBusy={setFusingPost} onFused={applyFusedDraft} />
      <p style={{ marginTop: 0, color: "var(--fused-muted)" }}>
        Set the name and ticker. You review everything before your wallet signs. AI never signs.
      </p>
      <div style={{ display: "grid", gap: 12 }}>
        {sourcePost ? (
          <Button type="button" variant="ghost" onClick={() => void onAiDraft()} disabled={pending}>
            {pending ? "Generating…" : "Generate AI draft"}
          </Button>
        ) : null}
        <label>
          Token name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Token name" className="fused-input" />
        </label>
        <label>
          Ticker
          <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="TICKER" className="fused-input" />
        </label>
        <label>
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional metadata"
            className="fused-input"
            rows={3}
          />
        </label>
        <label>
          Logo theme (optional)
          <input
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
            placeholder="Optional art direction for Generate AI logo"
            className="fused-input"
            maxLength={400}
          />
        </label>
        <label>
          Creator buy (ETH, optional)
          <input
            value={creatorBuy}
            onChange={(e) => setCreatorBuy(e.target.value)}
            placeholder="0"
            className="fused-input"
          />
        </label>
        <p style={{ margin: 0, color: "var(--fused-muted)", fontSize: 13 }}>
          Defaults to 0. Any amount is spent through the same bonding curve as every other buy — not a premine.
          It counts toward graduation. A buy large enough to hit the target graduates in this same transaction.
        </p>
        <div className="fused-quick-row fused-launch-media-row">
          <label style={{ flex: 1 }}>
            Upload logo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="fused-input"
              onChange={(e) => void onUpload(e.target.files?.[0])}
              disabled={generatingLogo || pending || fusingPost}
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void onAiImage()}
            disabled={generatingLogo || pending || fusingPost || !name.trim() || !symbol.trim()}
          >
            {generatingLogo ? "Generating…" : "Generate AI logo"}
          </Button>
        </div>
        {imagePreview ? (
          <div className="fused-token-preview">
            <img src={imagePreview} alt="" width={72} height={72} className="fused-logo-preview" />
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setImageId(null);
                setImagePreview(null);
              }}
            >
              No logo
            </Button>
          </div>
        ) : (
          <p style={{ margin: 0, color: "var(--fused-muted)", fontSize: 13 }}>No logo selected.</p>
        )}
        {wrongNetwork ? <p className="fused-form-error">Switch to {chainName} to launch.</p> : null}
        {logoError ? <p className="fused-form-error">{logoError}</p> : null}
        {error ? <p className="fused-form-error">{error}</p> : null}
        <Button type="button" variant="lime" onClick={() => void onReview()} disabled={pending || fusingPost}>
          Review launch
        </Button>
      </div>
    </Card>
  );
}

function SourcePost({ post }: { post: SocialPost }) {
  return (
    <div style={{ marginBottom: 18, paddingBottom: 16, borderBottom: "1px solid var(--fused-line, #1e293b)" }}>
      <p className="fused-kicker">Origin</p>
      <strong>
        {post.authorDisplayName || post.authorUsername}{" "}
        <span style={{ color: "var(--fused-muted)", fontWeight: 500 }}>@{post.authorUsername}</span>
      </strong>
      <p style={{ whiteSpace: "pre-wrap" }}>{post.text}</p>
      <a href={post.url} target="_blank" rel="noreferrer">
        View original post
      </a>
    </div>
  );
}

function humanError(caught: unknown): string {
  const text = caught instanceof Error ? caught.message : String(caught);
  for (const [code, message] of Object.entries(FUSED_ERROR_MESSAGES)) {
    if (text.includes(code)) return message;
  }
  if (text.includes("User rejected") || text.includes("denied")) return "Signature declined.";
  return text.slice(0, 280);
}
