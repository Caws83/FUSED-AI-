"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

export function HowItWorks({ src }: { src: string }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button type="button" className="fused-how-it-works" onClick={() => setOpen(true)}>
        <span className="fused-how-it-works-play" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path fill="currentColor" d="M8.4 5.6v12.8L19.2 12z" />
          </svg>
        </span>
        <span>how it works</span>
      </button>
      {open
        ? createPortal(
            <div
              className="fused-video-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onClick={() => setOpen(false)}
            >
              <p id={titleId} className="fused-sr-only">
                How it works
              </p>
              <video
                className="fused-video-modal-player"
                src={src}
                controls
                autoPlay
                playsInline
                onClick={(event) => event.stopPropagation()}
              />
              <button
                type="button"
                className="fused-token-zoom-close"
                aria-label="Close video"
                onClick={() => setOpen(false)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
