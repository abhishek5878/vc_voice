import type { SupabaseClient } from "@supabase/supabase-js";
import type { DebriefAnalysis } from "./types";

export interface DealDebriefRow {
  id: string;
  deal_id: string;
  transcript_text: string;
  result_json: DebriefAnalysis | null;
  created_at: string;
}

export async function insertDebrief(
  supabase: SupabaseClient,
  dealId: string,
  transcriptText: string,
  resultJson: DebriefAnalysis | null
): Promise<DealDebriefRow> {
  const { data, error } = await supabase
    .from("deal_debriefs")
    .insert({
      deal_id: dealId,
      transcript_text: transcriptText,
      result_json: resultJson,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DealDebriefRow;
}

export async function updateDebriefResult(
  supabase: SupabaseClient,
  debriefId: string,
  resultJson: DebriefAnalysis
): Promise<void> {
  const { error } = await supabase
    .from("deal_debriefs")
    .update({ result_json: resultJson })
    .eq("id", debriefId);
  if (error) throw error;
}

export async function getLatestDebriefForDeal(
  supabase: SupabaseClient,
  dealId: string
): Promise<DealDebriefRow | null> {
  const { data, error } = await supabase
    .from("deal_debriefs")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as DealDebriefRow | null;
}
