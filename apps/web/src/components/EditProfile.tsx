"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAddress } from "viem";
import { useAccount, useSignMessage } from "wagmi";
import { Button } from "@fused-ai/ui";
import {
  FUSED_PROFILE_NAME_MAX,
  fusedProfileUpdateMessage,
  parseFusedDisplayName,
  parseFusedPfpUrl,
} from "@fused-ai/validation";

type ProfilePayload = {
  ok?: boolean;
  displayName?: string | null;
  pfpUrl?: string | null;
  nonce?: number;
  error?: string;
};

export function EditProfile({
  onSaved,
}: {
  onSaved?: (profile: { displayName: string | null; pfpUrl: string | null }) => void;
}) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [displayName, setDisplayName] = useState("");
  const [pfpUrl, setPfpUrl] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!address) {
      setDisplayName("");
      setPfpUrl("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/social/profile?address=${encodeURIComponent(address)}`);
        const payload = (await response.json()) as ProfilePayload;
        if (cancelled || !payload.ok) return;
        setDisplayName(payload.displayName ?? "");
        setPfpUrl(payload.pfpUrl ?? "");
      } catch {
        if (!cancelled) setNotice("Could not load profile.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (!isConnected || !address) return null;
  const wallet = address;

  async function onUpload(file: File | undefined) {
    setNotice(null);
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/media/upload", { method: "POST", body });
    const json = (await res.json()) as { ok?: boolean; url?: string; error?: string };
    if (!json.ok || !json.url) {
      setNotice(json.error || "Upload is temporarily unavailable.");
      return;
    }
    setPfpUrl(json.url);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const name = parseFusedDisplayName(displayName);
    const pfp = parseFusedPfpUrl(pfpUrl);
    if (!name) {
      setNotice("Enter a display name.");
      return;
    }
    if (!pfp.ok) {
      setNotice("Choose a valid profile image.");
      return;
    }
    setBusy(true);
    try {
      const ready = await fetch(`/api/social/profile?address=${encodeURIComponent(wallet)}`);
      const current = (await ready.json()) as ProfilePayload;
      if (!ready.ok || typeof current.nonce !== "number") {
        setNotice(current.error || "Could not save profile.");
        return;
      }
      const checksum = getAddress(wallet);
      const message = fusedProfileUpdateMessage({
        address: checksum,
        displayName: name,
        pfpUrl: pfp.url ?? "",
        nonce: current.nonce,
      });
      const signature = await signMessageAsync({ message });
      const response = await fetch("/api/social/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address: checksum,
          displayName: name,
          pfpUrl: pfp.url ?? "",
          nonce: current.nonce,
          signature,
        }),
      });
      const payload = (await response.json()) as ProfilePayload;
      if (!response.ok || !payload.ok) {
        setNotice(payload.error || "Could not save profile.");
        return;
      }
      setDisplayName(payload.displayName ?? name);
      setPfpUrl(payload.pfpUrl ?? pfpUrl);
      onSaved?.({
        displayName: payload.displayName ?? name,
        pfpUrl: payload.pfpUrl ?? pfpUrl,
      });
      router.refresh();
    } catch {
      setNotice("Signature cancelled.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="fused-fuse-stack fused-profile-editor">
      <p className="fused-support">Edit Profile</p>
      <div className="fused-fuse-box">
        <div className="fused-profile-row">
          <div
            className="fused-avatar"
            style={pfpUrl ? { backgroundImage: `url(${pfpUrl})` } : undefined}
            aria-hidden="true"
          />
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Profile photo"
            disabled={busy}
            onChange={(event) => {
              void onUpload(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
        <input
          name="displayName"
          type="text"
          placeholder="Display name"
          value={displayName}
          maxLength={FUSED_PROFILE_NAME_MAX}
          aria-label="Display name"
          disabled={busy}
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <Button type="submit" variant="lime" size="lg" disabled={busy}>
          Save Profile
        </Button>
      </div>
      {notice ? <p className="fused-form-error">{notice}</p> : null}
    </form>
  );
}
