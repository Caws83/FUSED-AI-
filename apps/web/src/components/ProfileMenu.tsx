"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { EditProfile } from "./EditProfile.tsx";
import { shortenAddress } from "../lib/feed.ts";

type ProfilePayload = {
  ok?: boolean;
  displayName?: string | null;
  pfpUrl?: string | null;
};

export function ProfileMenu({ onOpen }: { onOpen?: () => void }) {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [pfpUrl, setPfpUrl] = useState<string | null>(null);

  useEffect(() => {
    setOpen(false);
    setEditing(false);
  }, [pathname, address]);

  useEffect(() => {
    if (!address) {
      setDisplayName(null);
      setPfpUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/social/profile?address=${encodeURIComponent(address)}`);
        const payload = (await response.json()) as ProfilePayload;
        if (cancelled || !payload.ok) return;
        setDisplayName(payload.displayName ?? null);
        setPfpUrl(payload.pfpUrl ?? null);
      } catch {
        if (!cancelled) {
          setDisplayName(null);
          setPfpUrl(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setEditing(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setEditing(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!isConnected || !address) return null;

  const avatar = (
    <span
      className="fused-avatar fused-profile-avatar"
      style={pfpUrl ? { backgroundImage: `url(${pfpUrl})` } : undefined}
      aria-hidden="true"
    />
  );

  return (
    <div className="fused-profile-menu" ref={rootRef}>
      <button
        type="button"
        className="fused-profile-trigger"
        aria-label="Open profile"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) onOpen?.();
          else setEditing(false);
        }}
      >
        {avatar}
      </button>
      {open ? (
        <div className="fused-profile-popover" role="dialog" aria-label="Profile">
          <button
            type="button"
            className="fused-profile-close"
            aria-label="Close profile"
            onClick={() => {
              setOpen(false);
              setEditing(false);
            }}
          >
            ×
          </button>
          {editing ? (
            <EditProfile
              onSaved={(profile) => {
                setDisplayName(profile.displayName);
                setPfpUrl(profile.pfpUrl);
              }}
            />
          ) : (
            <div className="fused-profile-summary">
              {avatar}
              {displayName ? <strong>{displayName}</strong> : null}
              <span>{shortenAddress(address)}</span>
              <button type="button" className="fused-btn fused-btn-ghost" onClick={() => setEditing(true)}>
                Edit Profile
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
