import { Type } from "@google/genai";
import type { GenAIClient, JsonSchema } from "./genai-client";

const FALLBACK_PROMPT =
  "You are orchestrating an Ace Attorney style trial. Keep dialogue concise and paced for live chat.";

export async function generateCasePrompt(
  genai: GenAIClient | null,
  extraText: string = "",
): Promise<string> {
  const fallback = appendExtra(FALLBACK_PROMPT, extraText);

  if (!genai) {
    return fallback;
  }

  try {
    const prompt = buildPrompt(extraText);
    const schema = buildSchema();
    const raw = await genai.generateJson<{ prompt: string }>(prompt, schema);
    const clean = sanitize(raw.prompt);
    return clean ? appendExtra(clean, extraText) : fallback;
  } catch (error) {
    console.error("generateCasePrompt failed, using fallback:", error);
    return fallback;
  }
}

function buildPrompt(extraText: string): string {
  return [
    "Create a trial premise for an Ace Attorney style scene. Max 2 long paragraph describing the case, crime (what did the defendant do?), and the crime scene. Do NOT write plot, previous trials, court dialogue, or previous story events.",
    "Must include: Prosecutor Miles Edgeworth, a Judge, one or more Witnesses, and a Defendant. The player is the Defense (Phoenix Wright). Add an extra character disguised as witness or defendant to create intrigue or conflict.",
    "Plain text only, no markdown.",
    extraText ? `Also include: ${extraText}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function sanitize(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  // If the model returned JSON or markdown, strip simple fences.
  const fenceStripped = trimmed.replace(/^[`\s]*|[`\s]*$/g, "") || trimmed;
  return (fenceStripped.split(/\n+/)[0] || trimmed).trim();
}

function appendExtra(base: string, extra: string): string {
  if (!extra) return base.trim();
  return `${base.trim()} ${extra.trim()}`.trim();
}

function buildSchema(): JsonSchema {
  return {
    type: Type.OBJECT,
    required: ["prompt"],
    properties: {
      prompt: { type: Type.STRING },
    },
  };
}
