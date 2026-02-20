"use client";

import { useState } from "react";

const PREVIEW_LEN = 180;

export default function CollapsibleHowIEvaluate({
  voiceProfileText,
  noProfileCopy,
}: {
  voiceProfileText: string | null;
  noProfileCopy: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasContent = Boolean(voiceProfileText?.trim());
  const preview =
    hasContent && voiceProfileText!.length > PREVIEW_LEN
      ? voiceProfileText!.slice(0, PREVIEW_LEN).trim() + "…"
      : voiceProfileText;

  if (!hasContent) {
    return <div className="text-zinc-400">{noProfileCopy}</div>;
  }

  const showToggle = voiceProfileText!.length > PREVIEW_LEN;

  return (
    <div className="space-y-2">
      <div className={`text-[15px] leading-relaxed text-zinc-200 ${expanded ? "whitespace-pre-wrap" : ""}`}>
        {expanded ? voiceProfileText : preview}
      </div>
      {showToggle && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
        >
          {expanded ? "Show less" : "Read how I evaluate"}
        </button>
      )}
    </div>
  );
}
