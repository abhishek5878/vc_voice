"use client";

import { useEffect, useRef } from "react";
import { loadRecentRuns, type RecentRunEntry } from "@/lib/sessionMetadata";

type Mode = 1 | 2 | 3;

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelectMode: (mode: Mode) => void;
  onSelectRecentRun: (run: RecentRunEntry) => void;
}

const MODES: { mode: Mode; label: string }[] = [
  { mode: 1, label: "Post-Meeting" },
  { mode: 2, label: "Pre-Meeting Prep" },
  { mode: 3, label: "Pitch Stress-Test" },
];

export default function CommandPalette({
  open,
  onClose,
  onSelectMode,
  onSelectRecentRun,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const recentRuns = open ? loadRecentRuns() : [];

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-lg rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-2 border-b border-zinc-800">
          <input
            ref={inputRef}
            type="text"
            placeholder="Switch mode or pick a recent run…"
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-amber-500/50"
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).value === "" && e.preventDefault()}
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          <div className="py-1">
            <p className="px-3 py-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">Modes</p>
            {MODES.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  onSelectMode(mode);
                  onClose();
                }}
                className="w-full text-left px-3 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800 flex items-center gap-2"
              >
                <span className="text-zinc-500 w-6">Mode {mode}</span>
                {label}
              </button>
            ))}
          </div>
          {recentRuns.length > 0 && (
            <div className="py-1 border-t border-zinc-800">
              <p className="px-3 py-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">Recent runs</p>
              {recentRuns.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => {
                    onSelectRecentRun(run);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800"
                >
                  <span className="font-medium">
                    {run.meetingTitle || run.companyName || `Mode ${run.mode} run`}
                  </span>
                  <span className="text-zinc-500 text-xs ml-2">
                    {new Date(run.timestamp).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  {run.redListPreview.length > 0 && (
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">
                      Red: {run.redListPreview[0].slice(0, 60)}…
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="px-3 py-2 text-[10px] text-zinc-600 border-t border-zinc-800">⌘K to open · Esc to close</p>
      </div>
    </div>
  );
}
