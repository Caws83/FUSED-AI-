"use client";

import { useMemo, useState } from "react";
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { parseEventLogs } from "viem";
import { Button, Card } from "@fused-ai/ui";
import {
  LAUNCH_ERROR_MESSAGES,
  LAUNCH_FACTORY_ABI,
  toLaunchParams,
  validateLaunchForm,
} from "@fused-ai/blockchain/abi";
import type { SocialPost } from "@fused-ai/types";

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
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { switchChain } = useSwitchChain();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [imageId, setImageId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [token, setToken] = useState<`0x${string}` | null>(null);

  const wrongNetwork = Boolean(isConnected && chainId && walletChainId !== chainId);
  const params = useMemo(() => {
    if (!address) return null;
    return toLaunchParams({ name, symbol, metadataURI: description, creator: address });
  }, [address, name, symbol, description]);

  if (!ready || !factory) {
    return (
      <Card>
        <p style={{ margin: 0, color: "var(--fused-muted)" }}>Launch is temporarily unavailable.</p>
      </Card>
    );
  }

  async function onUpload(file: File | undefined) {
    setError(null);
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
    if (!publicClient || !walletClient || !params || !address || !factory) {
      setError("Wallet is not ready.");
      return;
    }
    setPending(true);
    try {
      const { request } = await publicClient.simulateContract({
        address: factory,
        abi: LAUNCH_FACTORY_ABI,
        functionName: "launch",
        args: [params],
        account: address,
      });
      const hash = await walletClient.writeContract(request);
      setTxHash(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        setError("The transaction did not succeed.");
        return;
      }
      const launched = parseEventLogs({
        abi: LAUNCH_FACTORY_ABI,
        logs: receipt.logs,
        eventName: "Launched",
      })[0];
      const launchedToken = launched?.args.token;
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
          {name} launched
        </h2>
        <p style={{ color: "var(--fused-muted)" }}>
          {symbol.toUpperCase()} is onchain. Liquidity is locked.
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
          <img src={imagePreview} alt="" width={72} height={72} style={{ borderRadius: 16, objectFit: "cover" }} />
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
              {chainName} ({chainId})
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
            <dt>LP fee</dt>
            <dd>1%</dd>
          </div>
          {sourcePost ? (
            <div>
              <dt>Origin post</dt>
              <dd>@{sourcePost.authorUsername}</dd>
            </div>
          ) : null}
          <div>
            <dt>Action</dt>
            <dd>LaunchFactory.launch</dd>
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
      <p style={{ marginTop: 0, color: "var(--fused-muted)" }}>
        Set the name and ticker. You review everything before your wallet signs.
      </p>
      <div style={{ display: "grid", gap: 12 }}>
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
          Token logo
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="fused-input"
            onChange={(e) => void onUpload(e.target.files?.[0])}
          />
        </label>
        {imagePreview ? (
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <img src={imagePreview} alt="" width={64} height={64} style={{ borderRadius: 16, objectFit: "cover" }} />
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setImageId(null);
                setImagePreview(null);
              }}
            >
              Remove
            </Button>
          </div>
        ) : null}
        <p style={{ margin: 0, color: "var(--fused-muted)", fontSize: 13 }}>AI artwork — coming soon</p>
        {wrongNetwork ? <p className="fused-form-error">Switch to {chainName} to launch.</p> : null}
        {error ? <p className="fused-form-error">{error}</p> : null}
        <Button type="button" variant="lime" onClick={() => void onReview()}>
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
  for (const [code, message] of Object.entries(LAUNCH_ERROR_MESSAGES)) {
    if (text.includes(code)) return message;
  }
  if (text.includes("User rejected") || text.includes("denied")) return "Signature declined.";
  return text.slice(0, 280);
}
