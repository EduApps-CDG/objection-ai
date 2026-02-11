export { CaseManager } from "./case-manager";
export type {
  CaseDefinition,
  CaseManagerOptions,
  CaseState,
  EvidenceItem,
  NextBeatOptions,
  NextBeatResult,
} from "./case-manager";
export { CharacterManager } from "./character-manager";
export type {
  CharacterMemory,
  CharacterProfile,
  CharacterSpeech,
} from "./character-manager";
export { StoryManager } from "./story-manager";
export type { SpeakerCandidate, StoryManagerOptions, SpeechDraft, SceneSuggestion } from "./story-manager";
export { createGenAIClient } from "./genai-client";
export type { GenAIClient, GenAIConfig } from "./genai-client";
export { generateTrialCharacters } from "./character-generator";
export { generateCasePrompt } from "./story-generator";
export { generateEvidence } from "./evidence-generator";