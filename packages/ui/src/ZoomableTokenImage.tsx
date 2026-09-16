"use client";

import { useEffect, useId, useState } from "react";

export function ZoomableTokenImage({
  src,
  alt = "",
  width,
  height,
  className,
}: {
  src: string;
  alt?: string;
  width: number;
  height: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const label = alt.trim() || "View larger token image";

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
      <button
        type="button"
        className="fused-token-zoom-trigger"
        onClick={() => setOpen(true)}
        aria-label={label}
      >
        <img src={src} alt="" width={width} height={height} className={className} />
      </button>
      {open ? (
        <div
          className="fused-token-zoom"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={() => setOpen(false)}
        >
          <p id={titleId} className="fused-sr-only">
            {label}
          </p>
          <img
            src={src}
            alt=""
            className="fused-token-zoom-image"
            onClick={(event) => event.stopPropagation()}
          />
          <button
            type="button"
            className="fused-token-zoom-close"
            aria-label="Close image"
            onClick={() => setOpen(false)}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ) : null}
    </>
  );
}
