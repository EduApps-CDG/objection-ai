import { GoogleGenAI, type Schema } from "@google/genai";

export interface GenAIClient {
  model: string;
  generateJson: <T>(prompt: string, schema: JsonSchema) => Promise<T>;
}

export interface GenAIConfig {
  model?: string;
  apiKey: string;
  systemInstruction?: string;
}

export type JsonSchema = Schema;

export function createGenAIClient(config: GenAIConfig): GenAIClient | null {
  const client = new GoogleGenAI({
    apiKey: config.apiKey,
  });
  const model = config.model ?? "gemini-2.5-flash";

  return {
    model,
    async generateJson<T>(prompt: string, schema: JsonSchema): Promise<T> {
      console.log("[genai] request", { model, prompt, schema });
      const response = await client.models.generateContent({
        model,
        config: {
          responseMimeType: 'application/json',
            responseSchema: {
              ...schema as Record<string, unknown>,
            },
            responseJsonSchema: {
                ...schema as Record<string, unknown>
            }
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      });

      return parseJsonOrCoerce<T>(await extractText(response), schema);
    },
  };
}

// Try to parse JSON, but fall back to a best-effort object (helps when the model
// returns bare text instead of valid JSON).
function parseJsonOrCoerce<T>(text: string, schema: JsonSchema): T {
  const cleaned = text?.trim() ?? "";

  try {
    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.warn("[genai] JSON parse failed, coercing", { error });
  }

  const promptLike = (schema as { properties?: { prompt?: unknown } })?.properties?.prompt;
  if (promptLike && typeof cleaned === "string") {
    return { prompt: cleaned } as unknown as T;
  }

  // Last resort: wrap the raw string.
  return { value: cleaned } as unknown as T;
}

async function extractText(response: unknown): Promise<string> {
  const responseObject = response as {
    text?: string | (() => Promise<string>);
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  if (typeof responseObject.text === "function") {
    const text = await responseObject.text();
    return text?.trim() ?? "";
  }

  if (typeof responseObject.text === "string") {
    return responseObject.text.trim();
  }

  const parts = responseObject.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text)
    .filter((text): text is string => Boolean(text));

  return parts?.join("").trim() ?? "";
}
