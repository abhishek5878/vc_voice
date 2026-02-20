"use client";

import { useState } from "react";

const PITCHROBIN_URL = "https://pitchrobin.work";

export function SnapshotShare({
  snapshotUrl,
  vcDisplayName,
}: {
  snapshotUrl: string;
  vcDisplayName: string | null;
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedBadge, setCopiedBadge] = useState(false);

  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(snapshotUrl)}`;
  const badgeText = vcDisplayName
    ? `Stress-tested by ${vcDisplayName} via PitchRobin`
    : "Stress-tested by PitchRobin";

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex flex-wrap gap-2">
        <a
          href={linkedInUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-4 py-2 rounded-xl bg-[#0A66C2] hover:bg-[#004182] text-white text-sm font-medium transition-colors"
        >
          Share on LinkedIn
        </a>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(snapshotUrl).then(() => {
              setCopiedLink(true);
              setCopiedBadge(false);
              setTimeout(() => setCopiedLink(false), 2000);
            }).catch(() => {});
          }}
          className="px-4 py-2 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm font-medium transition-colors"
        >
          {copiedLink ? "Link copied" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(badgeText).then(() => {
              setCopiedBadge(true);
              setCopiedLink(false);
              setTimeout(() => setCopiedBadge(false), 2000);
            }).catch(() => {});
          }}
          className="px-4 py-2 rounded-xl border border-zinc-600 hover:bg-zinc-800 text-zinc-300 text-sm font-medium transition-colors"
        >
          {copiedBadge ? "Badge copied" : 'Copy "Tested by PitchRobin" badge'}
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        Add the badge to your deck: &quot;{badgeText}&quot;
      </p>
    </div>
  );
}

export function SnapshotFooterCta() {
  return (
    <a
      href={PITCHROBIN_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block text-sm text-cyan-400 hover:text-cyan-300 font-medium mt-4"
    >
      Get stress-tested before your next VC meeting →
    </a>
  );
}
