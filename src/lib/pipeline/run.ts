/**
 * SPA 4-layer pipeline orchestrator. Runs layers in sequence; each gets prior output as context.
 */
import { callLLMServer } from "@/lib/llm/callServer";
import type { LLMProvider } from "@/lib/llm/types";
import * as prompts from "./prompts";
import type {
  PipelineInput,
  PipelineResult,
  Layer1Output,
  Layer2Output,
  Layer3Output,
  Layer4Output,
  PreMeetingAttackBrief,
} from "./types";

const LAYER1_FORMAT_REMINDER = "\n\nReturn ONLY valid JSON with a top-level \"claims\" array. No markdown, no explanation.";

function parseJson<T>(raw: string, layer: string): T {
  let s = raw.trim();
  const jsonMatch = s.match(/\{[\s\S]*\}/);
  if (jsonMatch) s = jsonMatch[0];
  try {
    return JSON.parse(s) as T;
  } catch (e) {
    throw new Error(`Invalid JSON from ${layer}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function buildLayer1Input(ctx: PipelineInput["streamContext"]): string {
  return [ctx.PUBLIC_TRANSCRIPT, ctx.PITCH_MATERIAL].filter(Boolean).join("\n\n");
}

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const { streamContext, mode, apiKey, provider, model, voiceProfile } = input as PipelineInput & {
    voiceProfile?: string | null;
  };
  const ctx = streamContext;
  const publicTranscript = ctx.PUBLIC_TRANSCRIPT ?? "";
  const pitchMaterial = ctx.PITCH_MATERIAL ?? "";
  const privateDictation = ctx.PRIVATE_DICTATION ?? "";
  const pedigreeData = ctx.PEDIGREE_DATA ?? "";

  // Layer 1 — always run
  const layer1Input = buildLayer1Input(ctx);
  if (layer1Input.length < 200) {
    return {
      mode,
      layer_1: { claims: [] },
      layer_2: null,
      layer_3: { grue_coverage: [], blind_spots: [], coverage_score: 0 },
      layer_4: { red_list: [], yellow_list: [], pedigree_flags: [] },
      error: "Input too short for meaningful analysis. Paste your full transcript or pitch narrative.",
    };
  }

  let layer1: Layer1Output;
  try {
    const raw1 = await callLLMServer({
      provider: provider as LLMProvider,
      model,
      apiKey,
      messages: [
        {
          role: "user",
          content: prompts.layer1Prompt(publicTranscript, pitchMaterial),
        },
      ],
      jsonMode: true,
    });
    layer1 = parseJson<Layer1Output>(raw1.content, "Layer 1");
    if (!Array.isArray(layer1.claims)) layer1 = { claims: [] };
  } catch {
    const retryRaw = await callLLMServer({
      provider: provider as LLMProvider,
      model,
      apiKey,
      messages: [
        {
          role: "user",
          content: prompts.layer1Prompt(publicTranscript, pitchMaterial) + LAYER1_FORMAT_REMINDER,
        },
      ],
      jsonMode: true,
    }).catch(() => ({ content: "{}" }));
    try {
      layer1 = parseJson<Layer1Output>(retryRaw.content, "Layer 1 retry");
      if (!Array.isArray(layer1.claims)) layer1 = { claims: [] };
    } catch {
      return {
        mode,
        layer_1: { claims: [] },
        layer_2: null,
        layer_3: { grue_coverage: [], blind_spots: [], coverage_score: 0 },
        layer_4: { red_list: [], yellow_list: [], pedigree_flags: [] },
        error: "Extraction failed — input may be too short or unstructured. Try adding more context.",
      };
    }
  }

  const layer1Json = JSON.stringify(layer1);

  // Layer 2 — skip if no PRIVATE_DICTATION (Mode 1 with single stream still runs L2 with empty second stream per spec we can return skipped)
  let layer2: Layer2Output | null = null;
  if (publicTranscript && privateDictation) {
    try {
      const raw2 = await callLLMServer({
        provider: provider as LLMProvider,
        model,
        apiKey,
        messages: [{ role: "user", content: prompts.layer2Prompt(publicTranscript, privateDictation) }],
        jsonMode: true,
      });
      layer2 = parseJson<Layer2Output>(raw2.content, "Layer 2");
      if (!Array.isArray(layer2.conflicts)) layer2 = { ...layer2, conflicts: [] };
    } catch {
      layer2 = { conflicts: [], skipped: false };
    }
  } else {
    layer2 = { conflicts: [], skipped: true, skip_reason: "No private stream provided" };
  }

  const layer2Json = JSON.stringify(layer2);

  // Layer 3
  let layer3: Layer3Output;
  try {
    const raw3 = await callLLMServer({
      provider: provider as LLMProvider,
      model,
      apiKey,
      messages: [
        {
          role: "user",
          content: prompts.layer3Prompt(layer1Json, publicTranscript, pitchMaterial),
        },
      ],
      jsonMode: true,
    });
    layer3 = parseJson<Layer3Output>(raw3.content, "Layer 3");
    if (!Array.isArray(layer3.grue_coverage)) layer3 = { ...layer3, grue_coverage: [] };
    if (!Array.isArray(layer3.blind_spots)) layer3 = { ...layer3, blind_spots: [] };
    if (typeof layer3.coverage_score !== "number") layer3 = { ...layer3, coverage_score: 0 };
  } catch {
    layer3 = { grue_coverage: [], blind_spots: [], coverage_score: 0 };
  }

  const layer3Json = JSON.stringify(layer3);

  // Layer 4
  let layer4: Layer4Output;
  try {
    const raw4 = await callLLMServer({
      provider: provider as LLMProvider,
      model,
      apiKey,
      messages: [
        {
          role: "user",
          content: prompts.layer4Prompt(layer1Json, layer2Json, layer3Json, pedigreeData, voiceProfile),
        },
      ],
      jsonMode: true,
    });
    layer4 = parseJson<Layer4Output>(raw4.content, "Layer 4");
    if (!Array.isArray(layer4.red_list)) layer4 = { ...layer4, red_list: [] };
    if (!Array.isArray(layer4.yellow_list)) layer4 = { ...layer4, yellow_list: [] };
    if (!Array.isArray(layer4.pedigree_flags)) layer4 = { ...layer4, pedigree_flags: [] };
  } catch {
    layer4 = { red_list: [], yellow_list: [], pedigree_flags: [] };
  }

  const result: PipelineResult = {
    mode,
    layer_1: layer1,
    layer_2: layer2,
    layer_3: layer3,
    layer_4: layer4,
  };

  if (mode === 2) {
    result.pre_meeting_attack_brief = buildPreMeetingAttackBrief(layer4);
  }

  return result;
}

function buildPreMeetingAttackBrief(layer4: Layer4Output): PreMeetingAttackBrief {
  const red_list_framed = (layer4.red_list || []).slice(0, 5).map((r) => ({
    question: r.question,
    source_finding: r.source_description || "",
    framing: "They will not have a good answer to this. Probe hard.",
  }));
  const yellow_list_framed = (layer4.yellow_list || []).slice(0, 10).map((y) => ({
    question: y.question,
    source_finding: y.source_description || "",
    framing: "This is where you separate polish from preparation.",
  }));
  const recommended_sequence = [
    ...red_list_framed.map((_, i) => `Red ${i + 1}: ${red_list_framed[i].question.slice(0, 80)}…`),
    ...yellow_list_framed.slice(0, 5).map((_, i) => `Yellow ${i + 1}: ${yellow_list_framed[i].question.slice(0, 80)}…`),
  ];
  return { red_list_framed, yellow_list_framed, recommended_sequence };
}
