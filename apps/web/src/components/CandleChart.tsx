"use client";

import { useEffect, useRef, useState } from "react";
import { realPricePoints, sortCandles, type Candle } from "../lib/chart-series.ts";

export type { Candle };
export { sortCandles };

type HoverState = {
  index: number;
  x: number;
  y: number;
} | null;

const LEFT_PAD = 12;
const RIGHT_PAD = 64;
const TOP_PAD = 18;
const BOTTOM_PAD = 28;

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (value >= 1) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  }
  if (value >= 0.01) return value.toFixed(6);
  return value.toPrecision(5);
}

function formatVolume(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(2);
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatFullTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function xForTime(
  time: number,
  tMin: number,
  tMax: number,
  chartWidth: number,
  count: number,
): number {
  if (count <= 1) return LEFT_PAD + chartWidth / 2;
  const span = tMax - tMin;
  if (span <= 0) return LEFT_PAD + chartWidth / 2;
  return LEFT_PAD + ((time - tMin) / span) * chartWidth;
}

export function CandleChart({
  candles,
  emptyLabel = "No trades yet",
}: {
  candles: Candle[];
  emptyLabel?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = size.width;
    const height = size.height;
    if (width <= 0 || height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const background = "#f7fafc";
    const grid = "rgba(16, 32, 51, 0.06)";
    const text = "#6b7684";
    const line = "#1f8a3a";
    const chartWidth = Math.max(1, width - LEFT_PAD - RIGHT_PAD);
    const priceBottom = height - BOTTOM_PAD;
    const priceHeight = Math.max(1, priceBottom - TOP_PAD);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const points = realPricePoints(candles);
    if (points.length === 0) {
      ctx.fillStyle = text;
      ctx.font = "500 13px Inter, ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(emptyLabel, width / 2, height / 2);
      return;
    }

    const highs = points.map((p) => (Number.isFinite(p.high) ? p.high : p.close));
    const lows = points.map((p) => (Number.isFinite(p.low) ? p.low : p.close));
    const rawMax = Math.max(...highs, ...points.map((p) => p.close));
    const rawMin = Math.min(...lows, ...points.map((p) => p.close));
    const rawSpan = rawMax - rawMin || Math.abs(rawMax) || 1;
    const padding = rawSpan * 0.12;
    const maxPrice = rawMax + padding;
    const minPrice = Math.max(0, rawMin - padding);
    const priceSpan = maxPrice - minPrice || 1;
    const tMin = points[0].time;
    const tMax = points[points.length - 1].time;

    const yForPrice = (value: number) =>
      TOP_PAD + ((maxPrice - value) / priceSpan) * priceHeight;
    const xForPoint = (time: number) =>
      xForTime(time, tMin, tMax, chartWidth, points.length);

    const horizontalLines = 4;
    ctx.font = "500 11px Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= horizontalLines; i++) {
      const ratio = i / horizontalLines;
      const y = TOP_PAD + ratio * priceHeight;
      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(LEFT_PAD, y);
      ctx.lineTo(width - RIGHT_PAD, y);
      ctx.stroke();
      ctx.fillStyle = text;
      ctx.fillText(formatPrice(maxPrice - ratio * priceSpan), width - RIGHT_PAD + 8, y);
    }

    const timeMarkers = Math.min(4, points.length);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let i = 0; i < timeMarkers; i++) {
      const ratio = timeMarkers === 1 ? 0.5 : i / (timeMarkers - 1);
      const index = Math.min(points.length - 1, Math.round(ratio * (points.length - 1)));
      const x = xForPoint(points[index].time);
      ctx.fillStyle = text;
      ctx.fillText(formatTime(points[index].bucketStart), x, height - BOTTOM_PAD + 8);
    }

    const plotted = points.map((point) => ({
      ...point,
      x: xForPoint(point.time),
      y: yForPrice(point.close),
    }));

    if (plotted.length >= 2) {
      const gradient = ctx.createLinearGradient(0, TOP_PAD, 0, priceBottom);
      gradient.addColorStop(0, "rgba(31, 138, 58, 0.22)");
      gradient.addColorStop(1, "rgba(31, 138, 58, 0.02)");
      ctx.beginPath();
      plotted.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.lineTo(plotted[plotted.length - 1].x, priceBottom);
      ctx.lineTo(plotted[0].x, priceBottom);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      plotted.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.strokeStyle = line;
      ctx.lineWidth = 2.25;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
    }

    plotted.forEach((point, index) => {
      const latest = index === plotted.length - 1;
      if (!latest && plotted.length > 8) return;
      ctx.beginPath();
      ctx.arc(point.x, point.y, latest ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = line;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    const latest = plotted[plotted.length - 1];
    if (latest) {
      const label = formatPrice(latest.close);
      ctx.font = "700 11px Inter, ui-sans-serif, system-ui, sans-serif";
      const labelWidth = Math.min(RIGHT_PAD - 8, ctx.measureText(label).width + 14);
      const tagX = width - RIGHT_PAD + 4;
      const tagY = Math.max(TOP_PAD, Math.min(priceBottom - 22, latest.y - 11));
      ctx.fillStyle = line;
      ctx.beginPath();
      ctx.roundRect(tagX, tagY, labelWidth, 22, 6);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, tagX + 7, tagY + 11);
    }

    if (hover && hover.index >= 0 && hover.index < plotted.length) {
      const candle = plotted[hover.index];
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = "rgba(16, 32, 51, 0.16)";
      ctx.beginPath();
      ctx.moveTo(candle.x, TOP_PAD);
      ctx.lineTo(candle.x, priceBottom);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(LEFT_PAD, candle.y);
      ctx.lineTo(width - RIGHT_PAD, candle.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = line;
      ctx.beginPath();
      ctx.arc(candle.x, candle.y, 4, 0, Math.PI * 2);
      ctx.fill();

      const tooltipWidth = 188;
      const tooltipHeight = 112;
      const tooltipX = candle.x + tooltipWidth + 20 > width ? candle.x - tooltipWidth - 14 : candle.x + 14;
      const tooltipY = Math.max(10, Math.min(height - tooltipHeight - 10, candle.y - 40));
      ctx.fillStyle = "rgba(9,17,31,0.96)";
      ctx.beginPath();
      ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 10);
      ctx.fill();

      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 11px Inter, ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(formatFullTime(candle.bucketStart), tooltipX + 12, tooltipY + 10);
      ctx.font = "500 11px Inter, ui-sans-serif, system-ui, sans-serif";
      const rows = [
        ["O", formatPrice(candle.open)],
        ["H", formatPrice(candle.high)],
        ["L", formatPrice(candle.low)],
        ["C", formatPrice(candle.close)],
        ["Vol", formatVolume(candle.volume)],
      ];
      rows.forEach(([rowLabel, value], rowIndex) => {
        const y = tooltipY + 30 + rowIndex * 15;
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.textAlign = "left";
        ctx.fillText(rowLabel, tooltipX + 12, y);
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "right";
        ctx.fillText(value, tooltipX + tooltipWidth - 12, y);
      });
    }
  }, [candles, emptyLabel, hover, size]);

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const points = realPricePoints(candles);
    if (!canvas || points.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const chartWidth = Math.max(1, rect.width - LEFT_PAD - RIGHT_PAD);
    const tMin = points[0].time;
    const tMax = points[points.length - 1].time;
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    points.forEach((point, index) => {
      const px = xForTime(point.time, tMin, tMax, chartWidth, points.length);
      const dist = Math.abs(px - x);
      if (dist < bestDist) {
        best = index;
        bestDist = dist;
      }
    });
    setHover({ index: best, x, y });
  }

  return (
    <div ref={wrapRef} className="fused-chart-wrap">
      <canvas
        ref={canvasRef}
        className="fused-chart"
        aria-label="Price chart"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHover(null)}
      />
    </div>
  );
}
