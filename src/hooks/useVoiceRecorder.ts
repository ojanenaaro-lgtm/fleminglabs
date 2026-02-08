"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type RecordingState = "idle" | "recording" | "paused" | "processing";

export interface VoiceRecorderResult {
  state: RecordingState;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  audioBlob: Blob | null;
  duration: number;
  audioLevel: number;
  analyserNode: AnalyserNode | null;
  error: string | null;
  /** Intermediate blobs saved every SAVE_INTERVAL ms for crash recovery */
  savedChunks: Blob[];
}

const SAVE_INTERVAL = 30_000; // 30 seconds

export function useVoiceRecorder(): VoiceRecorderResult {
  const [state, setState] = useState<RecordingState>("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [savedChunks, setSavedChunks] = useState<Blob[]>([]);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const allChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelFrameRef = useRef<number>(0);
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const pauseStartRef = useRef<number>(0);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (levelFrameRef.current) cancelAnimationFrame(levelFrameRef.current);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
    };
  }, []);

  const updateAudioLevel = useCallback(() => {
    const analyserNode = analyserRef.current;
    if (!analyserNode) return;

    const data = new Uint8Array(analyserNode.fftSize);
    analyserNode.getByteTimeDomainData(data);

    // RMS calculation for a smooth level value
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    // Normalize to 0–1, with a slight boost so quiet speech still shows
    const level = Math.min(1, rms * 3);
    setAudioLevel(level);

    levelFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  const startDurationTimer = useCallback(() => {
    durationIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current - pausedDurationRef.current;
      setDuration(Math.floor(elapsed / 1000));
    }, 200);
  }, []);

  const saveIntermediateChunk = useCallback(() => {
    // Save whatever chunks we've accumulated so far
    if (allChunksRef.current.length === 0) return;
    const blob = new Blob(allChunksRef.current, { type: "audio/webm;codecs=opus" });
    setSavedChunks((prev) => [...prev, blob]);
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);
      setAudioBlob(null);
      setSavedChunks([]);
      chunksRef.current = [];
      allChunksRef.current = [];
      pausedDurationRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        },
      });
      streamRef.current = stream;

      // Set up Web Audio analyser for level metering
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 2048;
      analyserNode.smoothingTimeConstant = 0.8;
      source.connect(analyserNode);
      audioContextRef.current = ctx;
      analyserRef.current = analyserNode;
      setAnalyser(analyserNode);

      // Prefer webm/opus, fall back to whatever the browser supports
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          allChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        setState("processing");
        const blob = new Blob(chunksRef.current, {
          type: mimeType || "audio/webm",
        });
        setAudioBlob(blob);
        setState("idle");
      };

      // Request data every second so we accumulate chunks for periodic saves
      recorder.start(1000);
      mediaRecorderRef.current = recorder;

      startTimeRef.current = Date.now();
      setState("recording");
      startDurationTimer();
      updateAudioLevel();

      // Save intermediate chunks every 30s
      saveIntervalRef.current = setInterval(saveIntermediateChunk, SAVE_INTERVAL);
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access denied. Please allow microphone access in your browser settings."
          : "Failed to start recording. Please check your microphone.";
      setError(message);
      setState("idle");
    }
  }, [updateAudioLevel, startDurationTimer, saveIntermediateChunk]);

  const stop = useCallback(async () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
    if (levelFrameRef.current) {
      cancelAnimationFrame(levelFrameRef.current);
      levelFrameRef.current = 0;
    }
    setAudioLevel(0);

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      // Wrap in promise so caller can await the final blob
      await new Promise<void>((resolve) => {
        const origOnStop = recorder.onstop;
        recorder.onstop = (e) => {
          if (origOnStop) origOnStop.call(recorder, e);
          resolve();
        };
        recorder.stop();
      });
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAnalyser(null);
    mediaRecorderRef.current = null;
  }, []);

  const pause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.pause();
      pauseStartRef.current = Date.now();
      setState("paused");
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      if (levelFrameRef.current) {
        cancelAnimationFrame(levelFrameRef.current);
        levelFrameRef.current = 0;
      }
      setAudioLevel(0);
    }
  }, []);

  const resume = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "paused") {
      recorder.resume();
      pausedDurationRef.current += Date.now() - pauseStartRef.current;
      setState("recording");
      startDurationTimer();
      updateAudioLevel();
    }
  }, [startDurationTimer, updateAudioLevel]);

  return {
    state,
    start,
    stop,
    pause,
    resume,
    audioBlob,
    duration,
    audioLevel,
    analyserNode: analyser,
    error,
    savedChunks,
  };
}
