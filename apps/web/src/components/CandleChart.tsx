"use client";

import { useEffect, useRef } from "react";

export type Candle = {
  bucket_start: string;
  open_x18: string;
  high_x18: string;
  low_x18: string;
  close_x18: string;
  volume_quote: string;
};

function n(v: string): number {
  try {
    return Number(BigInt(v)) / 1e18;
  } catch {
    return 0;
  }
}

export function CandleChart({ candles, emptyLabel = "No trades yet" }: { candles: Candle[]; emptyLabel?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0b1524";
    ctx.fillRect(0, 0, width, height);
    if (candles.length === 0) {
      ctx.fillStyle = "#8a97a6";
      ctx.font = "14px sans-serif";
      ctx.fillText(emptyLabel, 16, height / 2);
      return;
    }
    const highs = candles.map((c) => n(c.high_x18));
    const lows = candles.map((c) => n(c.low_x18));
    const vols = candles.map((c) => n(c.volume_quote));
    const maxP = Math.max(...highs);
    const minP = Math.min(...lows);
    const span = maxP - minP || maxP || 1;
    const maxV = Math.max(...vols, 0);
    const volH = 56;
    const pad = 12;
    const chartH = height - volH - pad * 2;
    const slot = (width - pad * 2) / candles.length;

    candles.forEach((c, i) => {
      const o = n(c.open_x18);
      const h = n(c.high_x18);
      const l = n(c.low_x18);
      const cl = n(c.close_x18);
      const x = pad + i * slot + slot / 2;
      const y = (v: number) => pad + ((maxP - v) / span) * chartH;
      const up = cl >= o;
      ctx.strokeStyle = up ? "#c8f54a" : "#e11d48";
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(x, y(h));
      ctx.lineTo(x, y(l));
      ctx.stroke();
      const top = y(Math.max(o, cl));
      const bot = y(Math.min(o, cl));
      const body = Math.max(2, bot - top);
      ctx.fillRect(x - Math.max(2, slot * 0.3), top, Math.max(3, slot * 0.6), body);
      if (maxV > 0) {
        const vh = (n(c.volume_quote) / maxV) * (volH - 8);
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x - Math.max(2, slot * 0.3), height - 8 - vh, Math.max(3, slot * 0.6), vh);
        ctx.globalAlpha = 1;
      }
    });
  }, [candles, emptyLabel]);

  return <canvas ref={ref} className="fused-chart" aria-label="Price chart" />;
}
