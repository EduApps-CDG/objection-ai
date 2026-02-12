import type { GenAIClient, JsonSchema } from "./genai-client";
import type { EvidenceItem } from "./case-manager";
import { Type } from "@google/genai";

const FALLBACK_EVIDENCE: EvidenceItem[] = [
  {
    id: "ev1",
    name: "Autopsy Report",
    description: "Time of death approx. 2 AM; single stab wound.",
    type: "image",
    url: "",
  },
  {
    id: "ev2",
    name: "Security Photo",
    description: "Blurry photo of a figure entering the lobby at 1:45 AM.",
    type: "image",
    url: "",
  },
];

export async function generateEvidence(
  genai: GenAIClient | null,
  extraText: string = "",
): Promise<EvidenceItem[]> {
  if (!genai) {
    return FALLBACK_EVIDENCE;
  }

  try {
    const prompt = buildPrompt(extraText);
    const schema = buildSchema();
    const parsed = await genai.generateJson<EvidenceItem[]>(prompt, schema);
    return parsed.length > 0 ? parsed : FALLBACK_EVIDENCE;
  } catch (error) {
    console.error("generateEvidence failed, using fallback:", error);
    return FALLBACK_EVIDENCE;
  }
}

function buildPrompt(extraText: string): string {
  return [
    "Return a JSON array evidence items for an Ace Attorney style trial. Must include something like an autopsy report describing the victim.",
    "Each item fields: id (slug), name, description, type ('image' or 'video'), url (may be empty).",
    "Keep it concise; no markdown.",
    extraText ? `Also include: ${extraText}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSchema(): JsonSchema {
  return {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      required: ["id", "name", "description", "type", "url"],
      properties: {
        id: { type: Type.STRING },
        name: { type: Type.STRING },
        description: { type: Type.STRING, description: "Describe the piece of evidence. What is it? Where it was found? Do not post advices, storylines or instructions for the player. Max 2 short paragraphs." },
        type: { type: Type.STRING, enum: ["image", "video"] },
        url: { type: Type.STRING },
      },
    },
    minItems: "4",
    maxItems: "8",
  };
}
