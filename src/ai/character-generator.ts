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
    "Roles required: Prosecutor (name MUST be 'Miles Edgeworth' (charaId 2)), Judge (charaId 10), Witness (generate a name and append ' - Wt'), Defendant/Accused (generate a name and append ' - Df' (use a witness id)). An extra character disguised as witness or defendant must be generated to add mystery to the case in order to create intrigue or conflict. Do not generate character for player (Defense, Phoenix Wright).\n",
    "Tone: Ace Attorney-inspired.\n",
    "Possible witness image ids: " + Character.getPossibleWitnessIds().join(", ") + ". Assign one to the witness character (must not repeat).\n\n",
    
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
