import chalk from "chalk";
import type { CharacterState } from "../core/Character";

export interface SpeakerCandidate {
  id: number;
  username: string;
  role?: string;
  isHuman?: boolean;
  isTyping?: boolean;
}

export interface SceneSuggestion {
  action?: string;
  emotion?: "neutral" | "happy" | "sad" | "angry" | "surprised" | "nervous";
  poseId?: number;
  memory?: string[];
}

export interface SpeechDraft {
  text: string;
  scene?: SceneSuggestion;
  playerTurn?: boolean;
  memory?: string[];
  continueSpeech?: boolean;
}

export interface StoryManagerOptions {
  cooldownMs?: number;
  playerUsername?: string;
  genai?: any;
}

export class StoryManager {
  private keyPoints: string[] = [];
  private keyPointIndex = 0;
  private lastSpokenAt = new Map<number, number>();
  private cooldownMs: number;
  private aiTurnsRemaining = 0;
  private awaitingPlayer = true;
  private playerUsername: string;
  private genai: any;

  private speechLog: Array<{ speakerId?: number; speakerName: string; speakerState?:CharacterState; text: string; }> = [];

  constructor(options: StoryManagerOptions = {}) {
    this.cooldownMs = options.cooldownMs ?? 15000;
    this.playerUsername = options.playerUsername ?? "eduapps";
    this.genai = options.genai ?? null;
  }

  public getLast20Messages(): Array<{ speakerId?: number; speakerName: string; speakerState?:CharacterState; text: string; }> {
    return this.speechLog.slice(-20);
  }

  public logSpeech(speakerId: number | undefined, speakerName: string, text: string, speakerState?:CharacterState): void {
    this.speechLog.push({ speakerId, speakerName, speakerState, text });
    if (speakerId) {
      this.lastSpokenAt.set(speakerId, Date.now());
    }
  }

  public buildSpeechLogTranscript(roleLookup?: Map<string, string>): string | null {
    const entries = this.getLast20Messages();
    if (!entries.length) {
      return null;
    }

    const lines = entries.map((entry) => {
      const role = entry.speakerId
        ? roleLookup?.get(entry.speakerName) ?? "Character"
        : "Defense";
      const state = entry.speakerState
        ? ` (poseId=${entry.speakerState.poseId}, mood=${entry.speakerState.mood})`
        : "";
      return `[${role}] ${entry.speakerName}${state}: ${entry.text}`;
    });

    return lines.join("\n");
  }

  beginPlayerTurn(username: string, aiTurnBudget: number): void {
    this.playerUsername = username;
    this.awaitingPlayer = false;
    this.aiTurnsRemaining = Math.max(0, aiTurnBudget);
  }

  openAiWindow(turns: number | undefined): void {
    this.awaitingPlayer = false;
    this.aiTurnsRemaining = Math.max(0, turns ?? 0);
  }

  completeAiTurn(): void {
    if (this.aiTurnsRemaining > 0) {
      this.aiTurnsRemaining -= 1;
    }

    if (this.aiTurnsRemaining <= 0) {
      this.awaitingPlayer = true;
    }
  }

  forcePlayerTurn(): void {
    this.awaitingPlayer = true;
    this.aiTurnsRemaining = 0;
  }

  isPlayerTurn(): boolean {
    return this.awaitingPlayer || this.aiTurnsRemaining <= 0;
  }

  hasAiTurnAvailable(): boolean {
    return !this.isPlayerTurn();
  }

  setKeyPoints(points: string[]): void {
    this.keyPoints = [...points];
    this.keyPointIndex = 0;
  }

  addKeyPoint(point: string): void {
    this.keyPoints.push(point);
  }

  getCurrentKeyPoint(): string | undefined {
    return this.keyPoints[this.keyPointIndex];
  }

  getKeyPoints(): string[] {
    return [...this.keyPoints];
  }

  advanceKeyPoint(): string | undefined {
    if (this.keyPointIndex < this.keyPoints.length - 1) {
      this.keyPointIndex += 1;
    }

    return this.getCurrentKeyPoint();
  }

  async chooseSpeaker(
    candidates: SpeakerCandidate[],
    context?: {
      storyPrompt?: string;
      lastMsg?: string;
      lastSpeakerName?: string | null;
      lastSpeakerId?: number | null;
      lastSpeakerWantsContinue?: boolean;
      evidences?: Array<{ name: string }>;
      characterMemories?: Map<number, Array<{ entry: string }>>;
    },
    now: number = Date.now(),
  ): Promise<SpeakerCandidate | undefined> {
    if (this.isPlayerTurn()) {
      return;
    }

    const npcCandidates = candidates.filter((candidate) => !candidate.isHuman);
    
    if (npcCandidates.length === 0) {
      return;
    }

    // If last speaker wants to continue, prioritize them
    if (context?.lastSpeakerWantsContinue && context.lastSpeakerId) {
      const continuingSpeaker = npcCandidates.find(c => c.id === context.lastSpeakerId);
      if (continuingSpeaker) {
        console.log(`[speaker choice] ${continuingSpeaker.username} continues speaking (requested continuation)`);
        return continuingSpeaker;
      }
    }

    // If AI is unavailable, pick the NPC who hasn't spoken in the longest time (cooldown)
    if (!this.genai || !context) {
      return this.pickByCooldown(npcCandidates, now);
    }

    // Use AI to choose the most appropriate speaker
    const npcPick = await this.aiChooseSpeaker(npcCandidates, context);
    if (npcPick) {
      return npcPick;
    }

    return undefined; //Player's turn if AI fails to pick
  }

  recordSpeech(speakerId: number, now: number = Date.now()): void {
    this.lastSpokenAt.set(speakerId, now);
  }

  getFallbackInterjection(): string {
    return "stop";
  }

  refineSpeech(draft: SpeechDraft): SpeechDraft {
    // Placeholder hook for narrative corrections or global style adjustments.
    return draft;
  }

  private async aiChooseSpeaker(
    candidates: SpeakerCandidate[],
    context: {
      storyPrompt?: string;
      lastMsg?: string;
      lastSpeakerName?: string | null;
      lastSpeakerId?: number | null;
      lastSpeakerWantsContinue?: boolean;
      evidences?: Array<{ name: string }>;
      characterMemories?: Map<number, Array<{ entry: string }>>;
    },
  ): Promise<SpeakerCandidate | undefined> {
    const characterDetails = candidates.map((c, i) => {
      const memories = context.characterMemories?.get(c.id);
      const memoryStr = memories?.length ? ` (remembers: ${memories.slice(-2).map(m => m.entry).join("; ")})` : "";
      return `${i + 1}. ${c.username} (id: ${c.id})${memoryStr}`;
    }).join("\n");

    const roleLookup = new Map(candidates.map((c) => [c.username, c.role ?? "Character"]));
    const transcript = this.buildSpeechLogTranscript(roleLookup);
    const transcriptBlock = transcript ? `Recent transcript:\n${transcript}` : "";

    const prompt = [
      `Story: ${context.storyPrompt ?? "Ace Attorney trial"}`,
      context.evidences?.length ? `Evidence: ${context.evidences.map((e) => e.name).join(", ")}` : "",
      context.lastSpeakerName ? `Last speaker: ${context.lastSpeakerName}` : "",
      `Last message: "${context.lastMsg ?? ""}"`,
      transcriptBlock,
      "\nWho should speak next to continue the trial naturally?",
      "Consider: continuation needs, natural flow, courtroom dynamics, character memories.",
      "set speakerId to the id of the chosen character, or null to skip and let player speak. Briefly explain your choice in the reason field.",
      `\nAvailable characters:\n${characterDetails}`
    ].filter(Boolean).join("\n");

    const schema = {
      type: "object" as const,
      properties: {
        speakerId: { type: ["number", "null"] as const, description: "The id of the character who should speak next. Set null if you want to skip this turn (set to player's turn)" },
        reason: { type: "string" as const, description: "Brief reason for this choice" },
      },
      additionalProperties: false,
    };

    try {
      const result = await this.genai.generateJson(prompt, schema);
      if (!result.speakerId) {
        console.log(`[ai speaker choice]`, chalk.gray(`Player's turn`));
        masterCourt.sendPlainMessage({
          text: `[master] Player's turn`,
        });
        return;
      }
      const chosen = candidates.find((c) => c.id === result.speakerId);
      console.log(`[ai speaker choice]`, chalk.gray(`${chosen?.username} (${result.speakerId} - ${result.reason ?? "no reason"})`));
      masterCourt.sendPlainMessage({
        text: `[master] ${chosen?.username} will speak next (${result.reason ?? "no reason"})`,
      });
      return chosen;
    } catch (error) {
      console.warn("[ai speaker choice] failed, using fallback", error);
      return undefined;
    }
  }

  private pickByCooldown(
    candidates: SpeakerCandidate[],
    now: number,
  ): SpeakerCandidate | undefined {
    const eligible = candidates/*.filter((candidate) => {
      const lastSpoken = this.lastSpokenAt.get(candidate.id);
      return !lastSpoken || now - lastSpoken >= this.cooldownMs;
    })*/;

    if (eligible.length === 0) {
      return;
    }

    return eligible.sort((a, b) => {
      const aLast = this.lastSpokenAt.get(a.id) ?? 0;
      const bLast = this.lastSpokenAt.get(b.id) ?? 0;
      return aLast - bLast;
    })[0];
  }
}
