"use client";

import { useRef, useEffect, useCallback } from "react";
import type { RecordingState } from "@/hooks/useVoiceRecorder";

interface AudioWaveformProps {
  analyserNode: AnalyserNode | null;
  state: RecordingState;
  className?: string;
}

const STATE_COLORS: Record<RecordingState, string> = {
  recording: "#2D5A3D", // forest green
  paused: "#7C9A82",    // sage
  idle: "#d4dcd4",      // border/gray
  processing: "#d4dcd4",
};

const STATE_COLORS_LIGHT: Record<RecordingState, string> = {
  recording: "rgba(45, 90, 61, 0.12)",
  paused: "rgba(124, 154, 130, 0.10)",
  idle: "rgba(212, 220, 212, 0.08)",
  processing: "rgba(212, 220, 212, 0.08)",
};

export function AudioWaveform({ analyserNode, state, className }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  // Store history for smooth animation when paused/idle
  const historyRef = useRef<number[]>([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Size canvas for retina
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }

    const w = rect.width;
    const h = rect.height;
    const midY = h / 2;

    ctx.clearRect(0, 0, w, h);

    const color = STATE_COLORS[state];
    const colorLight = STATE_COLORS_LIGHT[state];

    let amplitudes: number[];

    if (analyserNode && (state === "recording" || state === "paused")) {
      const bufferLength = analyserNode.frequencyBinCount;
      const data = new Uint8Array(bufferLength);
      analyserNode.getByteTimeDomainData(data);

      // Downsample to ~64 points for a smooth wave
      const points = 64;
      const step = Math.floor(bufferLength / points);
      amplitudes = [];
      for (let i = 0; i < points; i++) {
        const val = (data[i * step] - 128) / 128;
        amplitudes.push(val);
      }

      // When paused, fade amplitudes toward zero
      if (state === "paused") {
        amplitudes = amplitudes.map((v) => v * 0.15);
      }

      historyRef.current = amplitudes;
    } else {
      // Idle / processing: gentle ambient wave
      const points = 64;
      amplitudes = [];
      const t = Date.now() / 2000;
      for (let i = 0; i < points; i++) {
        const x = i / points;
        amplitudes.push(
          Math.sin(x * Math.PI * 2 + t) * 0.04 +
          Math.sin(x * Math.PI * 4 - t * 0.7) * 0.02
        );
      }
    }

    const points = amplitudes.length;

    // Draw filled area under wave (subtle)
    ctx.beginPath();
    ctx.moveTo(0, midY);
    for (let i = 0; i < points; i++) {
      const x = (i / (points - 1)) * w;
      const y = midY + amplitudes[i] * midY * 0.85;
      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        // Smooth curve using cubic bezier between points
        const prevX = ((i - 1) / (points - 1)) * w;
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, midY + amplitudes[i - 1] * midY * 0.85, cpX, y, x, y);
      }
    }
    ctx.lineTo(w, midY);
    // Mirror bottom
    for (let i = points - 1; i >= 0; i--) {
      const x = (i / (points - 1)) * w;
      const y = midY - amplitudes[i] * midY * 0.85;
      if (i === points - 1) {
        ctx.lineTo(x, y);
      } else {
        const nextX = ((i + 1) / (points - 1)) * w;
        const cpX = (nextX + x) / 2;
        ctx.bezierCurveTo(cpX, midY - amplitudes[i + 1] * midY * 0.85, cpX, y, x, y);
      }
    }
    ctx.closePath();
    ctx.fillStyle = colorLight;
    ctx.fill();

    // Draw the main waveform line (top half)
    ctx.beginPath();
    for (let i = 0; i < points; i++) {
      const x = (i / (points - 1)) * w;
      const y = midY + amplitudes[i] * midY * 0.85;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = ((i - 1) / (points - 1)) * w;
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, midY + amplitudes[i - 1] * midY * 0.85, cpX, y, x, y);
      }
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Mirror line (bottom half)
    ctx.beginPath();
    for (let i = 0; i < points; i++) {
      const x = (i / (points - 1)) * w;
      const y = midY - amplitudes[i] * midY * 0.85;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = ((i - 1) / (points - 1)) * w;
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, midY - amplitudes[i - 1] * midY * 0.85, cpX, y, x, y);
      }
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center line
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.strokeStyle = state === "recording" ? "rgba(45, 90, 61, 0.15)" : "rgba(0,0,0,0.05)";
    ctx.lineWidth = 1;
    ctx.stroke();

    frameRef.current = requestAnimationFrame(draw);
  }, [analyserNode, state]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(draw);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
