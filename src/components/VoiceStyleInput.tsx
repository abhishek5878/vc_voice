"use client";

import { useRef, useState, useCallback } from "react";

/** Browser speech recognition type (not in all TS envs). */
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (e: SpeechRecognitionEvent) => void;
  onend: () => void;
  onerror: (e: Event) => void;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

interface VoiceStyleInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  /** Callback to get auth token for upload (transcribe API). */
  getAccessToken: () => Promise<string | null>;
  label?: string;
  hint?: string;
  className?: string;
  textareaClassName?: string;
}

export default function VoiceStyleInput({
  value,
  onChange,
  placeholder = "e.g. I look for repeat founders with clear metrics. I pass when it's pre-product...",
  rows = 5,
  disabled,
  getAccessToken,
  label = "Describe how you evaluate (type or add voice)",
  hint = "Type below, or record / upload a short voice note and we'll use the transcript.",
  className = "",
  textareaClassName = "",
}: VoiceStyleInputProps) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const appendText = useCallback(
    (toAppend: string) => {
      const trimmed = toAppend.trim();
      if (!trimmed) return;
      onChange(value ? `${value}\n\n${trimmed}` : trimmed);
    },
    [value, onChange]
  );

  const startRecording = useCallback(() => {
    const SR = typeof window !== "undefined" ? window.SpeechRecognition ?? window.webkitSpeechRecognition : undefined;
    if (!SR) {
      setRecognitionError("Voice input not supported in this browser. Try Chrome or paste a transcript.");
      return;
    }
    setRecognitionError(null);
    const rec = new SR() as SpeechRecognitionInstance;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const last = e.results[e.resultIndex];
      if (!last.isFinal) return;
      const transcript = last[0]?.transcript?.trim();
      if (transcript) appendText(transcript);
    };
    rec.onend = () => setRecording(false);
    rec.onerror = () => setRecording(false);
    try {
      rec.start();
      recognitionRef.current = rec;
      setRecording(true);
    } catch {
      setRecognitionError("Could not start microphone.");
    }
  }, [appendText]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setRecording(false);
  }, []);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const token = await getAccessToken();
      if (!token) {
        setRecognitionError("Sign in to use voice upload.");
        e.target.value = "";
        return;
      }
      setRecognitionError(null);
      setUploading(true);
      try {
        const formData = new FormData();
        formData.set("audio", file);
        const res = await fetch("/api/profile/transcribe", {
          method: "POST",
          headers: { "x-supabase-access-token": token },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.detail || "Transcription failed");
        const text = (data.text as string)?.trim();
        if (text) appendText(text);
      } catch (err) {
        setRecognitionError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [getAccessToken, appendText]
  );

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-zinc-300">{label}</label>
      )}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={`w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 resize-y ${textareaClassName}`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          disabled={disabled || uploading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs font-medium disabled:opacity-50"
        >
          {recording ? (
            <>
              <span className="inline-block w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              Stop recording
            </>
          ) : (
            <>Record voice</>
          )}
        </button>
        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs font-medium cursor-pointer disabled:opacity-50">
          <input
            type="file"
            accept="audio/*,.mp3,.m4a,.wav,.webm,.mpga,.mpeg"
            onChange={handleUpload}
            disabled={disabled || uploading}
            className="hidden"
          />
          {uploading ? "Transcribing…" : "Upload audio"}
        </label>
      </div>
      {recognitionError && (
        <p className="text-xs text-cyan-400/90">{recognitionError}</p>
      )}
    </div>
  );
}
