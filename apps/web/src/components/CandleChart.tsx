"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

export type Candle = {
  bucket_start: string;
  open_x18: string;
  high_x18: string;
  low_x18: string;
  close_x18: string;
  volume_quote: string;
};

type HoverState = {
  index: number;
  x: number;
  y: number;
} | null;

function x18ToNumber(v: string): number {
  try {
    const value = Number(BigInt(v));
    return Number.isFinite(value) ? value / 1e18 : 0;
  } catch {
    return 0;
  }
}

export function sortCandles(candles: Candle[]): Candle[] {
  return candles
    .filter((c) => Boolean(c?.bucket_start))
    .slice()
    .sort((a, b) => {
      const left = Date.parse(a.bucket_start);
      const right = Date.parse(b.bucket_start);
      return (Number.isNaN(left) ? 0 : left) - (Number.isNaN(right) ? 0 : right);
    });
}

function n(v: string): number {
  return x18ToNumber(v);
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return "0";

  if (value >= 1000) {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  }

  if (value >= 1) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  }

  if (value >= 0.01) {
    return value.toFixed(6);
  }

  return value.toPrecision(5);
}

function formatVolume(value: number): string {
  if (!Number.isFinite(value)) return "0";

  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return value.toFixed(2);
}

function formatTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFullTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const [size, setSize] = useState({
    width: 0,
    height: 0,
  });

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

    return () => {
      observer.disconnect();
    };
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
    const grid = "rgba(16, 32, 51, 0.08)";
    const text = "#6b7684";
    const strongText = "#102033";

    const up = "#1f8a3a";
    const down = "#d21f45";

    const leftPad = 14;
    const rightPad = 68;
    const topPad = 16;
    const bottomPad = 28;

    const volumeHeight = 64;
    const volumeGap = 12;

    const priceBottom =
      height -
      bottomPad -
      volumeHeight -
      volumeGap;

    const priceHeight =
      priceBottom - topPad;

    const chartWidth =
      width - leftPad - rightPad;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const ordered = sortCandles(candles);
    if (ordered.length === 0) {
      ctx.fillStyle = text;
      ctx.font =
        '500 13px Inter, ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillText(
        emptyLabel,
        width / 2,
        height / 2,
      );

      return;
    }

    const parsed = ordered.map((c) => ({
      ...c,
      open: n(c.open_x18),
      high: n(c.high_x18),
      low: n(c.low_x18),
      close: n(c.close_x18),
      volume: n(c.volume_quote),
    }));

    const highs = parsed.map((c) => c.high);
    const lows = parsed.map((c) => c.low);
    const volumes = parsed.map((c) => c.volume);

    const rawMax = Math.max(...highs);
    const rawMin = Math.min(...lows);

    const rawSpan =
      rawMax - rawMin || rawMax || 1;

    const padding =
      rawSpan * 0.08;

    const maxPrice =
      rawMax + padding;

    const minPrice =
      Math.max(0, rawMin - padding);

    const priceSpan =
      maxPrice - minPrice || 1;

    const maxVolume =
      Math.max(...volumes, 0);

    const lineMode =
      parsed.length < 12 ||
      parsed.every(
        (c) =>
          c.open === c.close &&
          c.high === c.close &&
          c.low === c.close,
      );

    const slot =
      chartWidth / parsed.length;

    const candleWidth = Math.max(
      3,
      Math.min(12, slot * 0.58),
    );

    const yForPrice = (value: number) =>
      topPad +
      ((maxPrice - value) / priceSpan) *
        priceHeight;

    const xForIndex = (index: number) =>
      leftPad +
      index * slot +
      slot / 2;

    // horizontal grid + price labels
    const horizontalLines = 5;

    ctx.font =
      '500 11px Inter, ui-sans-serif, system-ui, sans-serif';

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    for (
      let i = 0;
      i <= horizontalLines;
      i++
    ) {
      const ratio = i / horizontalLines;

      const y =
        topPad + ratio * priceHeight;

      const value =
        maxPrice -
        ratio * priceSpan;

      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(leftPad, y);
      ctx.lineTo(
        width - rightPad,
        y,
      );
      ctx.stroke();

      ctx.fillStyle = text;

      ctx.fillText(
        formatPrice(value),
        width - rightPad + 10,
        y,
      );
    }

    // vertical grid + time labels
    const timeMarkers = Math.min(
      5,
      parsed.length,
    );

    for (
      let i = 0;
      i < timeMarkers;
      i++
    ) {
      const ratio =
        timeMarkers === 1
          ? 0
          : i / (timeMarkers - 1);

      const index = Math.min(
        parsed.length - 1,
        Math.round(
          ratio *
            (parsed.length - 1),
        ),
      );

      const x = xForIndex(index);

      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(x, topPad);
      ctx.lineTo(
        x,
        height - bottomPad,
      );
      ctx.stroke();

      ctx.fillStyle = text;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      ctx.fillText(
        formatTime(
          parsed[index].bucket_start,
        ),
        x,
        height - bottomPad + 8,
      );
    }

    // divider above volume
    const volumeTop =
      priceBottom + volumeGap;

    ctx.strokeStyle =
      "rgba(16, 32, 51, 0.08)";
    ctx.beginPath();
    ctx.moveTo(
      leftPad,
      priceBottom + volumeGap / 2,
    );
    ctx.lineTo(
      width - rightPad,
      priceBottom + volumeGap / 2,
    );
    ctx.stroke();

    // candles + volume
    parsed.forEach((c, index) => {
      const x = xForIndex(index);

      const isUp =
        c.close >= c.open;

      const color = isUp
        ? up
        : down;

      if (!lineMode) {
        const highY =
          yForPrice(c.high);

        const lowY =
          yForPrice(c.low);

        const openY =
          yForPrice(c.open);

        const closeY =
          yForPrice(c.close);

        ctx.strokeStyle = color;
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();

        const bodyTop = Math.min(
          openY,
          closeY,
        );

        const bodyBottom = Math.max(
          openY,
          closeY,
        );

        const bodyHeight = Math.max(
          2,
          bodyBottom - bodyTop,
        );

        ctx.fillStyle = color;

        ctx.fillRect(
          x - candleWidth / 2,
          bodyTop,
          candleWidth,
          bodyHeight,
        );
      }

      if (maxVolume > 0) {
        const usableVolumeHeight =
          volumeHeight - 8;

        const volumeBarHeight =
          (c.volume / maxVolume) *
          usableVolumeHeight;

        ctx.globalAlpha = 0.3;
        ctx.fillStyle = color;

        ctx.fillRect(
          x - candleWidth / 2,
          volumeTop +
            volumeHeight -
            volumeBarHeight,
          candleWidth,
          volumeBarHeight,
        );

        ctx.globalAlpha = 1;
      }
    });

    if (lineMode && parsed.length > 0) {
      ctx.strokeStyle = up;
      ctx.lineWidth = 2;
      ctx.beginPath();
      parsed.forEach((c, index) => {
        const x = xForIndex(index);
        const y = yForPrice(c.close);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      parsed.forEach((c, index) => {
        const x = xForIndex(index);
        const y = yForPrice(c.close);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = up;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // latest price marker
    const latest =
      parsed[parsed.length - 1];

    if (latest) {
      const latestY =
        yForPrice(latest.close);

      ctx.setLineDash([4, 4]);

      ctx.strokeStyle =
        "rgba(31, 138, 58, 0.35)";

      ctx.beginPath();

      ctx.moveTo(
        leftPad,
        latestY,
      );

      ctx.lineTo(
        width - rightPad,
        latestY,
      );

      ctx.stroke();

      ctx.setLineDash([]);

      const label =
        formatPrice(latest.close);

      ctx.font =
        '700 11px Inter, ui-sans-serif, system-ui, sans-serif';

      const labelWidth =
        ctx.measureText(label).width + 14;

      ctx.fillStyle = up;

      ctx.fillRect(
        width -
          rightPad +
          4,
        latestY - 11,
        Math.min(
          rightPad - 8,
          labelWidth,
        ),
        22,
      );

      ctx.fillStyle = "#ffffff";

      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      ctx.fillText(
        label,
        width -
          rightPad +
          11,
        latestY,
      );
    }

    // hover/crosshair
    if (
      hover &&
      hover.index >= 0 &&
      hover.index < parsed.length
    ) {
      const candle =
        parsed[hover.index];

      const x =
        xForIndex(hover.index);

      const crosshairY = Math.max(
        topPad,
        Math.min(
          priceBottom,
          hover.y,
        ),
      );

      ctx.setLineDash([3, 4]);

      ctx.strokeStyle =
        "rgba(16, 32, 51, 0.18)";

      ctx.beginPath();
      ctx.moveTo(x, topPad);
      ctx.lineTo(
        x,
        height - bottomPad,
      );
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(
        leftPad,
        crosshairY,
      );
      ctx.lineTo(
        width - rightPad,
        crosshairY,
      );
      ctx.stroke();

      ctx.setLineDash([]);

      // candle focus marker
      ctx.fillStyle =
        candle.close >= candle.open
          ? up
          : down;

      ctx.beginPath();
      ctx.arc(
        x,
        yForPrice(candle.close),
        3,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      // tooltip
      const tooltipWidth = 188;
      const tooltipHeight = 112;

      const tooltipX =
        x + tooltipWidth + 20 >
        width
          ? x - tooltipWidth - 14
          : x + 14;

      const tooltipY = Math.max(
        10,
        Math.min(
          height -
            tooltipHeight -
            10,
          crosshairY - 40,
        ),
      );

      ctx.fillStyle =
        "rgba(9,17,31,0.96)";

      ctx.strokeStyle =
        "rgba(255,255,255,0.10)";

      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.roundRect(
        tooltipX,
        tooltipY,
        tooltipWidth,
        tooltipHeight,
        10,
      );

      ctx.fill();
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      ctx.fillStyle = strongText;
      ctx.font =
        '700 11px Inter, ui-sans-serif, system-ui, sans-serif';

      ctx.fillText(
        formatFullTime(
          candle.bucket_start,
        ),
        tooltipX + 12,
        tooltipY + 10,
      );

      ctx.font =
        '500 11px Inter, ui-sans-serif, system-ui, sans-serif';

      const rows = [
        ["O", formatPrice(candle.open)],
        ["H", formatPrice(candle.high)],
        ["L", formatPrice(candle.low)],
        ["C", formatPrice(candle.close)],
        [
          "Vol",
          formatVolume(candle.volume),
        ],
      ];

      rows.forEach(
        ([label, value], rowIndex) => {
          const y =
            tooltipY +
            30 +
            rowIndex * 15;

          ctx.fillStyle = text;
          ctx.fillText(
            label,
            tooltipX + 12,
            y,
          );

          ctx.fillStyle = strongText;

          ctx.textAlign = "right";

          ctx.fillText(
            value,
            tooltipX +
              tooltipWidth -
              12,
            y,
          );

          ctx.textAlign = "left";
        },
      );
    }
  }, [
    candles,
    emptyLabel,
    hover,
    size,
  ]);

  function handlePointerMove(
    event: React.PointerEvent<HTMLCanvasElement>,
  ) {
    const canvas = canvasRef.current;

    const ordered = sortCandles(candles);

    if (!canvas || ordered.length === 0) {
      return;
    }

    const rect =
      canvas.getBoundingClientRect();

    const x =
      event.clientX - rect.left;

    const y =
      event.clientY - rect.top;

    const leftPad = 14;
    const rightPad = 68;

    const chartWidth =
      rect.width -
      leftPad -
      rightPad;

    const slot =
      chartWidth /
      ordered.length;

    const index = Math.max(
      0,
      Math.min(
        ordered.length - 1,
        Math.floor(
          (x - leftPad) / slot,
        ),
      ),
    );

    setHover({
      index,
      x,
      y,
    });
  }

  return (
    <div
      ref={wrapRef}
      className="fused-chart-wrap"
    >
      <canvas
        ref={canvasRef}
        className="fused-chart"
        aria-label="Price chart"
        onPointerMove={handlePointerMove}
        onPointerLeave={() =>
          setHover(null)
        }
      />
    </div>
  );
}