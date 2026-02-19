"use client";

import { useEffect } from "react";

export type ToastType = "info" | "success" | "warning";

export default function Toast({
  message,
  actionLabel,
  onAction,
  onDismiss,
  dismissAfterMs,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  dismissAfterMs?: number;
}) {
  useEffect(() => {
    if (dismissAfterMs == null) return;
    const t = setTimeout(onDismiss, dismissAfterMs);
    return () => clearTimeout(t);
  }, [dismissAfterMs, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 shadow-xl text-zinc-100 text-sm"
    >
      <span>{message}</span>
      {actionLabel && onAction && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onAction();
              onDismiss();
            }}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-medium"
          >
            {actionLabel}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="px-2 py-1 text-zinc-400 hover:text-zinc-200"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      {!(actionLabel && onAction) && (
        <button type="button" onClick={onDismiss} className="px-2 text-zinc-400 hover:text-zinc-200" aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}
