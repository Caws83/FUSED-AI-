"use client";

import { useMemo, useState } from "react";
import { useAccount, useConfig } from "wagmi";
import { parseEther, parseEventLogs } from "viem";
import { Button, Card, ZoomableTokenImage } from "@fused-ai/ui";
import {
  FUSED_ERROR_MESSAGES,
  FUSED_FACTORY_ABI,
  toCreateParams,
} from "@fused-ai/blockchain/fused";
import { validateLaunchForm } from "@fused-ai/blockchain/abi";
import type { SocialPost } from "@fused-ai/types";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@fused-ai/config/public";
import {
  asLaunchAddress,
  chainLabelFor,
  nativeCurrencyFor,
  newLaunchForWallet,
  writeClientError,
} from "../lib/wallet.ts";
import { resolveWriteClients } from "../lib/wallet-clients.ts";
import { FusePost, type FusedDraft } from "./FusePost.tsx";

type Step = "form" | "review" | "done";

export function ManualLaunch({
  ready,
  sourcePost = null,
}: {
  ready: boolean;
  sourcePost?: SocialPost | null;
}) {
  const { address, isConnected, connector, chainId: walletChainId } = useAccount();
  const config = useConfig();

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
  const [fusedSource, setFusedSource] = useState<FusedDraft["source"]>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [token, setToken] = useState<`0x${string}` | null>(null);

  const launch = isConnected ? newLaunchForWallet(walletChainId) : null;
  const factory = asLaunchAddress(launch?.factory ?? null);
  const locker = asLaunchAddress(launch?.locker ?? null);
  const chainId = launch?.chainId ?? null;
  const chainName = chainLabelFor(chainId ?? walletChainId) ?? "this network";
  const quoteSymbol = nativeCurrencyFor(chainId ?? (isConnected ? walletChainId : ROBINHOOD_TESTNET_CHAIN_ID)).symbol;
  const originPost = sourcePost
    ? {
        postId: sourcePost.postId,
        url: sourcePost.url,
        username: sourcePost.authorUsername,
        excerpt: sourcePost.text,
      }
    : fusedSource
      ? { ...fusedSource, excerpt: description }
      : null;
  const params = useMemo(() => {
    return toCreateParams({ name, symbol, metadataURI: description });
  }, [name, symbol, description]);

  if (!ready) {
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
    setFusedSource(draft.source);
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

  function launchGate(): string | null {
    if (!isConnected || !address) return "Connect a wallet to continue.";
    if (!walletChainId) return "Switch to Robinhood Testnet or Arc Testnet to launch.";
    if (!newLaunchForWallet(walletChainId) || !factory || !chainId) {
      return "This network is not supported. Switch to Robinhood Testnet or Arc Testnet.";
    }
    return null;
  }

  async function onReview() {
    setError(null);
    const invalid = validateLaunchForm({ name, symbol, metadataURI: description });
    if (invalid) {
      setError(invalid);
      return;
    }
    const gated = launchGate();
    if (gated) {
      setError(gated);
      return;
    }
    setStep("review");
  }

  async function onLaunch() {
    setError(null);
    if (!isConnected || !address) {
      setError(writeClientError("account"));
      return;
    }
    const live = newLaunchForWallet(walletChainId);
    const liveFactory = asLaunchAddress(live?.factory ?? null);
    if (!live || !liveFactory) {
      setError("This network is not supported. Switch to Robinhood Testnet or Arc Testnet.");
      return;
    }
    setPending(true);
    try {
      const resolved = await resolveWriteClients(config, { chainId: live.chainId, account: address, connector });
      if (!resolved.ok) {
        setError(writeClientError(resolved.reason));
        return;
      }
      const { publicClient, walletClient } = resolved;
      const launchParams = toCreateParams({ name, symbol, metadataURI: description });
      const value = creatorBuy.trim() ? parseEther(creatorBuy) : 0n;
      const { request } = await publicClient.simulateContract({
        address: liveFactory,
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
      await fetch(`/api/launch/sync?tx=${hash}&chainId=${walletChainId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageId,
          imageUrl: imagePreview,
          sourcePostId: originPost?.postId,
          sourcePostUrl: originPost?.url,
          sourceExcerpt: originPost?.excerpt,
          description,
          chainId: walletChainId,
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
        <p className="fused-review-lead">
          Check these details before your wallet signs. AI never signs.
        </p>

        <div className="fused-review-identity">
          {imagePreview ? (
            <ZoomableTokenImage
              src={imagePreview}
              alt={`${name || "Token"} logo`}
              width={96}
              height={96}
              className="fused-logo-preview fused-review-logo"
            />
          ) : (
            <div className="fused-review-logo-fallback" aria-hidden="true" />
          )}
          <div>
            <p className="fused-review-name">{params.name}</p>
            <p className="fused-review-ticker">${params.symbol}</p>
          </div>
        </div>

        <section className="fused-review-section">
          <h3>Token</h3>
          <dl className="fused-review">
            {description.trim() ? (
              <div className="fused-review-wide">
                <dt>Description</dt>
                <dd className="fused-review-copy">{description.trim()}</dd>
              </div>
            ) : null}
            <div className="fused-review-wide">
              <dt>Creator buy</dt>
              <dd>
                {creatorBuy.trim()
                  ? `${creatorBuy} ${quoteSymbol} through the bonding curve`
                  : `0 ${quoteSymbol} — no creator buy`}
              </dd>
            </div>
            {originPost ? (
              <div className="fused-review-wide">
                <dt>Origin post</dt>
                <dd>
                  <a href={originPost.url} target="_blank" rel="noopener noreferrer">
                    @{originPost.username}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="fused-review-section">
          <h3>Network</h3>
          <dl className="fused-review">
            <div>
              <dt>Chain</dt>
              <dd>
                {chainName}
                <span className="fused-review-aside">
                  {chainId ?? walletChainId ?? "—"}
                </span>
              </dd>
            </div>
            <div>
              <dt>Quote</dt>
              <dd>{quoteSymbol}</dd>
            </div>
            <div className="fused-review-wide">
              <dt>Wallet</dt>
              <dd className="fused-review-mono">
                {address.slice(0, 6)}…{address.slice(-4)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="fused-review-section">
          <h3>Launch</h3>
          <dl className="fused-review">
            <div className="fused-review-wide">
              <dt>Lifecycle</dt>
              <dd>Bonding curve, then Uniswap at graduation</dd>
            </div>
            <div className="fused-review-wide">
              <dt>Action</dt>
              <dd>FusedFactory.create on the connected chain</dd>
            </div>
            <div className="fused-review-wide">
              <dt>Factory</dt>
              <dd className="fused-review-mono">
                {factory ?? "Unavailable on this network"}
              </dd>
            </div>
            {locker ? (
              <div className="fused-review-wide">
                <dt>Locker</dt>
                <dd className="fused-review-mono">{locker}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        {error ? <p className="fused-form-error">{error}</p> : null}
        <div className="fused-cta-row">
          <Button type="button" variant="ghost" onClick={() => setStep("form")} disabled={pending}>
            Back
          </Button>
          <Button type="button" variant="lime" onClick={() => void onLaunch()} disabled={pending || !factory}>
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
        Set the name and ticker. You review everything before your wallet signs. AI never signs. The connected wallet
        network chooses the factory.
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
          Creator buy ({quoteSymbol}, optional)
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
            <ZoomableTokenImage
              src={imagePreview}
              alt={`${name || "Token"} logo`}
              width={72}
              height={72}
              className="fused-logo-preview"
            />
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
        {!isConnected ? (
          <p className="fused-form-error">Connect a wallet on Robinhood Testnet or Arc Testnet to launch.</p>
        ) : !factory ? (
          <p className="fused-form-error">This network is not supported. Switch to Robinhood Testnet or Arc Testnet.</p>
        ) : null}
        {logoError ? <p className="fused-form-error">{logoError}</p> : null}
        {error ? <p className="fused-form-error">{error}</p> : null}
        <Button type="button" variant="lime" onClick={() => void onReview()} disabled={pending || fusingPost || !factory}>
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
