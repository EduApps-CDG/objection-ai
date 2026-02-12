import type { GenAIClient, JsonSchema } from "./genai-client";
import type CourtroomWebSocketClient from "../api/courtroom-websocket-client";
import type { SpeechDraft } from "./story-manager";
import Character from "../core/Character";
import { Type } from "@google/genai";

export interface CharacterSpeech {
  text: string;
  timestamp: number;
}

function buildSpeechSchema(character: Character): JsonSchema {
  return {
    type: Type.OBJECT,
    required: ["text", "playerTurn", "scene"],
    properties: {
      text: { type: Type.STRING, description: "The dialogue line that the character will speak" },
      playerTurn: { type: Type.BOOLEAN, description: "Set to true if you need player (Defense) answer after this message." },
      continueSpeech: { type: Type.BOOLEAN, description: "Set to true if you (this character) want to speak again immediately in the next message." },
      scene: {
        type: Type.OBJECT,
        required: ["poseId"],
        properties: {
          action: { type: Type.STRING },
          emotion: { type: Type.STRING, enum: ["neutral", "happy", "sad", "angry", "surprised", "nervous"] },
          poseId: {
            type: Type.STRING,
            enum: character.getPossiblePoses().map((pose) => ''+pose.id),
          },
        },
      },
      memory: {
        type: Type.ARRAY,
        description: "Short strings that the character wants to remember, for example an insult from the player or an important clue or contracdiction himself just said. Keep entries concise (<=12 words).",
        items: { type: Type.STRING },
        maxItems: "4"
      },
    },
  };
}

export interface CharacterMemory {
  entry: string;
  timestamp: number;
}

export interface CharacterProfile {
  id: number;
  name: string;
  description?: string;
  isHuman?: boolean;
  initialPoseId?: number;
  role?: string;
  characterId?: number;
  disguised?: boolean; // For the extra character that adds intrigue
}

export class CharacterManager {
  readonly id: number;
  readonly name: string;
  readonly description?: string;
  readonly isHuman: boolean;
  readonly characterId: number;
  readonly role?: string;
  readonly disguised?: boolean;
  private poseId?: number;
  private memory: CharacterMemory[] = [];
  private speeches: CharacterSpeech[] = [];
  private socket: CourtroomWebSocketClient | null = null;
  private character: Character | null = null;
  private mood: "neutral" | "happy" | "sad" | "angry" | "surprised" | "nervous" = "neutral";

  constructor(profile: CharacterProfile) {
    this.id = profile.id;
    this.name = profile.name;
    this.description = profile.description;
    this.isHuman = profile.isHuman ?? false;
    this.poseId = profile.initialPoseId;
    this.role = profile.role;
    if (!profile.characterId) {
      throw new Error(`Missing characterId for profile ${profile.id}`);
    }
    this.characterId = profile.characterId;
    this.disguised = profile.disguised;
  }

  setPose(poseId?: number): void {
    this.character?.setPose(poseId ?? this.pickDefaultPoseId());
  }

  getPose(): number | undefined {
    return this.character?.getCurrentPoseId();
  }

  recordSpeech(text: string, timestamp: number = Date.now()): void {
    this.speeches.push({ text, timestamp });
  }

  getRecentSpeech(limit: number = 5): CharacterSpeech[] {
    return this.speeches.slice(-limit);
  }

  getMemory(limit: number = 10): CharacterMemory[] {
    return this.memory.slice(-limit);
  }

  buildContext(limit: number = 5): string {
    const recentSpeech = this.getRecentSpeech(limit)
      .map((speech) => `- ${speech.text}`)
      .join("\n");

    const recentMemory = this.getMemory(limit)
      .map((item) => `- ${item.entry}`)
      .join("\n");

    const presetSnippet = this.character?.getPossiblePoses()?.slice(0, 6).map((pose) => `${pose.id}:${pose.name}`).join(", ") ?? "";

    return [
      `Name: ${this.name}`,
      this.description ? `Description: ${this.description}` : "",
      `PresetId: ${this.characterId}`,
      `Current mood: ${this.mood}`,
      `PoseId: ${this.character?.getCurrentPoseId() ?? "unknown"}`,
      presetSnippet ? `Available poses (id:name): ${presetSnippet}\n\n` : "",
      recentMemory ? `Recent memory:\n${recentMemory}` : "",
      recentSpeech ? `Recent speech:\n${recentSpeech}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  async generateSpeech(
    prompt: string,
    genai: GenAIClient | null,
  ): Promise<SpeechDraft> {
    if (!genai || !this.character) {
      return { text: "" };
    }

    const fullPrompt = `${this.buildContext()}\n\nPrompt:\n${prompt}\n\nReturn JSON only (no markdown) with: text (Character speech), scene (object with optional action, emotion, poseId), memory (array of short strings to remember), playerTurn, continueSpeech (boolean - set true if YOU want to speak again immediately after this message, If witness is being cross-examined, set to true so it can explain in detail). If you pick a poseId, use one from the available list. Keep memory entries concise (<=12 words) and only add when needed.`;

    const schema = buildSpeechSchema(this.character);
    const response = await genai.generateJson<SpeechDraft>(fullPrompt, schema);

    response!.scene!.poseId = parseInt(response.scene?.poseId as unknown as string) || this.character.getCurrentPoseId() || this.pickDefaultPoseId();
    return {
      text: response.text?.trim() ?? "",
      scene: response.scene,
      playerTurn: response.playerTurn,
      memory: response.memory,
      continueSpeech: response.continueSpeech ?? false,
    };
  }

  bindSocket(socket: CourtroomWebSocketClient | null): void {
    this.socket = socket;
    if (!this.socket) {
      this.character = null;
      return;
    }

    const initialPoseId = this.poseId ?? this.pickDefaultPoseId();
    this.character = new Character(
      this.socket,
      this.name,
      this.description ?? "",
      { poseId: initialPoseId, characterId: this.characterId, mood: this.mood },
      this.isHuman,
    );
    this.poseId = initialPoseId;
  }

  sendPlainMessage(text: string): void {
    this.socket?.sendPlainMessage({ text });
  }

  async sendMessage(draft: SpeechDraft): Promise<void> {
    const character = this.ensureCharacter();

    if (draft.scene?.poseId !== undefined) {
      this.setPose(draft.scene.poseId);
    }

    if (draft.scene?.emotion) {
      const normalized = this.normalizeMood(draft.scene.emotion);
      if (normalized) {
        this.mood = normalized;
        character.setMood(normalized);
      }
    }

    draft.memory?.forEach((entry) => this.addMemory(entry));

    const poseId = character.getCurrentPoseId() ?? this.pickDefaultPoseId();

    await character.speech(draft.text, poseId);
  }

  addMemory(entry: string, timestamp: number = Date.now()): void {
    this.memory.push({ entry, timestamp });
    this.character?.addMemory(entry);
  }

  getCharacterId(): number {
    return this.characterId;
  }

  getState(): { poseId: number; characterId: number; mood: typeof this.mood } {
    return {
      poseId: this.getPose() ?? this.pickDefaultPoseId(),
      characterId: this.characterId,
      mood: this.mood,
    };
  }

  private buildPresetSnippet(): string {
    const data = Character.getCharacterData(this.characterId);
    if (!data?.poses?.length) {
      return "";
    }

    return data.poses
      .slice(0, 6)
      .map((pose) => `${pose.id}:${pose.name}`)
      .join(" | ");
  }

  private pickDefaultPoseId(): number {
    const data = Character.getCharacterData(this.characterId);
    return this.poseId ?? data?.poses?.[0]?.id ?? 0;
  }

  private ensureCharacter(): Character {
    if (!this.character) {
      throw new Error(`Character ${this.id} is not bound to a socket.`);
    }

    return this.character;
  }

  private normalizeMood(value: string): typeof this.mood | null {
    const lowered = value.toLowerCase();
    const allowed: typeof this.mood[] = ["neutral", "happy", "sad", "angry", "surprised", "nervous"];
    return allowed.includes(lowered as typeof this.mood) ? (lowered as typeof this.mood) : null;
  }
}
