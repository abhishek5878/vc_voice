import { ImageResponse } from "next/og";
import { getDealPublicForSnapshot, getDealRunsForResult, getVcDisplayByUserId } from "@/lib/deals/db";

export const alt = "PitchRobin Belief Map snapshot";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function riskLabel(riskScore: number | null): string {
  if (riskScore == null) return "—";
  if (riskScore <= 25) return "Low";
  if (riskScore <= 50) return "Medium";
  if (riskScore <= 75) return "High";
  return "Fragile";
}

export default async function OgImage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const deal = await getDealPublicForSnapshot(dealId);
  if (!deal) {
    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", background: "#18181b", display: "flex", alignItems: "center", justifyContent: "center", color: "#71717a", fontSize: 24 }}>
        PitchRobin
      </div>,
      { ...size }
    );
  }
  const runs = await getDealRunsForResult(dealId);
  const lastRun = runs[0];
  const clarityScore = lastRun?.clarity_score != null ? Math.round(lastRun.clarity_score) : null;
  const riskScore = lastRun?.risk_score ?? null;
  const vc = await getVcDisplayByUserId(deal.user_id);
  const companyDisplay = deal.company_name && deal.company_name !== "Unknown" ? deal.company_name : "Unnamed company";
  const byLine = vc.display_name ? `Stress-tested by ${vc.display_name}` : "Stress-tested by PitchRobin";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(180deg, #18181b 0%, #09090b 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>
        <div style={{ fontSize: 56, fontWeight: 700, color: "#fafafa", textAlign: "center", maxWidth: 900 }}>
          {companyDisplay.length > 40 ? `${companyDisplay.slice(0, 37)}…` : companyDisplay}
        </div>
        <div style={{ display: "flex", gap: 48, fontSize: 28, color: "#a1a1aa" }}>
          <span>Clarity {clarityScore != null ? `${clarityScore}/100` : "—"}</span>
          <span>Risk {riskLabel(riskScore)}</span>
        </div>
        <div style={{ fontSize: 22, color: "#22d3ee" }}>{byLine}</div>
        <div style={{ fontSize: 18, color: "#52525b" }}>pitchrobin.work</div>
      </div>
    </div>,
    { ...size }
  );
}
