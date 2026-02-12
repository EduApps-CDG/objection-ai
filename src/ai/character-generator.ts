import type { GenAIClient, JsonSchema } from "./genai-client";
import type { CharacterProfile } from "./character-manager";
import Character from "../core/Character";
import { Type } from "@google/genai";

interface GeneratedCharacter {
  id: number;
  name: string;
  description: string;
  role: string;
}

export async function generateTrialCharacters(
  genai: GenAIClient | null,
  storyline:string
): Promise<CharacterProfile[]> {
  const fallback = getFallbackCharacters();

  if (!genai) {
    return fallback;
  }

  try {
    const prompt = buildPrompt(storyline);
    const schema = buildSchema();
    const parsed = await genai.generateJson<GeneratedCharacter[]>(prompt, schema);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return fallback;
    }

    return parsed.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      isHuman: false,
      role: c.role,
    }));
  } catch (error) {
    console.error("generateTrialCharacters failed, using fallback:", error);
    return fallback;
  }
}

function buildPrompt(storyline: string): string {
  return [
    "Generate characters for an Ace Attorney trial. Required roles:\n",
    "1. Prosecutor: Name MUST be 'Miles Edgeworth' (characterId 2)\n",
    "2. Judge: (characterId 10)\n",
    "3-4. At least TWO witnesses with ' - Wt' suffix (use different witness characterIds from the list below)\n",
    "5. Defendant with ' - Df' suffix (use a witness characterId)\n",
    "Optional: One extra character (witness or defendant) who is secretly disguised/suspicious to add intrigue.\n",
    "\nIMPORTANT: Witnesses and defendants should have interesting personalities and motivations that make them want to speak during the trial!",
    "\nDO NOT generate character for player (Defense Attorney, Phoenix Wright).\n",
    "Tone: Ace Attorney-inspired.\n",
    "Possible witness/defendant characterIds: " + Character.getPossibleWitnessIds().slice(0, 20).join(", ") + "... (assign unique IDs, no repeats)\n\n",
    
    "Storyline: " +
    storyline
  ].join("\n");
}

function buildSchema(): JsonSchema {
  return {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      required: ["id", "name", "description", "role"],
      properties: {
        id: { type: Type.NUMBER },
        name: { type: Type.STRING },
        description: {
          type: Type.STRING,
          description: "Describe the character's personality, motivations, and role, alibi (what they were doing) in the trial. Max 3 paragraphs.",
          maxLength: "314"
        },
        role: {
          type: Type.STRING,
          enum: ["Prosecutor", "Judge", "Witness", "Defendant"],
        },
        disguised: {
          type: Type.BOOLEAN,
          description: "Optional property to indicate if the character is the disguised one. Cannot be true for Prosecutor nor Judge.",
        }, // Optional property to indicate if the character is the disguised one
      },
    },
    minItems: "5",
    maxItems: "8",
  };
}

function getFallbackCharacters(): CharacterProfile[] {
  return [
    {
      id: 2,
      name: "Miles Edgeworth",
      description: "Sharply analytical prosecutor AI.",
      isHuman: false,
      role: "Prosecutor",
    },
    {
      id: 10,
      name: "Judge",
      description: "Even-handed AI judge.",
      isHuman: false,
      role: "Judge",
    },
    {
      id: 4,
      name: "Witness",
      description: "AI witness with a shaky memory.",
      isHuman: false,
      role: "Witness",
    },
    {
      id: 5,
      name: "Defendant",
      description: "Nervous AI defendant.",
      isHuman: false,
      role: "Defendant",
    },
  ];
}
