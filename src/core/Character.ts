import type CourtroomWebSocketClient from "../api/courtroom-websocket-client";

export interface CharacterPose {
    id: number;
    name: string;
    characterId: number;
    iconUrl: string;
    order: number;
    idleImageUrl: string;
    speakImageUrl: string;
    poseAudioTicks: number[];
    poseFunctionTicks: number[];
    poseStates: any[];
}

export interface CharacterData {
    id: number;
    isPreset: boolean;
    name: string;
    nameplate: string;
    side: "defense"|"prosecution"|"witness"|"judge";
    backgroundId: number;
    blipUrl: string;
    alignment: any;
    galleryAJImageUrl: any;
    galleryImageUrl: string;
    iconUrl: string;
    limitWidth: boolean;
    offsetX: number;
    offsetY: number;
    userId: any;
    poses: CharacterPose[];
}

export interface CharacterState {
    poseId: number;
    characterId: number;
    mood:"neutral" | "happy" | "sad" | "angry" | "surprised" | "nervous";
}

export default class Character {
    private static characterCache: CharacterData[] = [];

    public readonly id: number;
    public readonly name: string;
    public readonly description: string;
    public readonly isHuman: boolean;
    private state: CharacterState;
    private memory: string[] = [];
    private courtroom: CourtroomWebSocketClient;

    /**
     * 
     * @param name fictional name
     * @param description fictional description
     * @param state character display state
     * @param isHuman is this character human?
     */
    constructor(courtroom:CourtroomWebSocketClient, name: string, description: string, state:CharacterState={poseId: 0, characterId: 0, mood: "neutral"}, isHuman: boolean=false) {
        const characterData = Character.characterCache.find(char => char.id === state.characterId);
        if (!characterData) {
            throw new Error(`Character with ID ${state.characterId} not found in cache.`);
        }

        this.courtroom = courtroom;
        this.id = characterData.id;
        this.state = state;
        this.name = name;
        this.description = description;
        this.isHuman = isHuman;
    }

    public static getCachedCharacters(): CharacterData[] {
        return this.characterCache;
    }

    public static getCharacterData(id: number): CharacterData | undefined {
        return this.characterCache.find((char) => char.id === id);
    }

    public static async fetchCharacterData() {
        if (this.characterCache.length > 0) {
            return this.characterCache;
        }

        //https://objection.lol/api/assets/character/getPreset
        const response = await fetch("https://objection.lol/api/assets/character/getPreset");
        ///@ts-ignore
        const data: CharacterData[] = await response.json();
        this.characterCache = data;
    }

    public addMemory(memory: string) {
        this.memory.push(memory);
    }

    public getMemory() {
        return this.memory;
    }

    public getMood() {
        return this.state.mood;
    }

    public static getPossibleWitnessIds(): string[] {
        const witnesses = this.characterCache.filter(char => char.side === "witness").map(char => char.id.toString()+':'+char.name);
        return witnesses.sort(() => Math.random() - 0.5);
    }

    public setMood(mood: "neutral" | "happy" | "sad" | "angry" | "surprised" | "nervous") {
        this.state.mood = mood;
    }

    public setPose(poseId: number) {
        this.state.poseId = poseId;
    }

    public getCurrentPoseId() {
        return this.state.poseId;
    }

    public getPossiblePoses() {
        const characterData = Character.characterCache.find(char => char.id === this.state.characterId);
        if (!characterData) {
            throw new Error(`Character with ID ${this.state.characterId} not found in cache.`);
        }
        return characterData.poses;
    }

    public async speech(text: string, poseId?: number): Promise<void> {
        this.state.poseId = poseId ?? this.state.poseId;
        console.log(`${this.name} (${this.id}) says: ${text}`, this.state);
        
        // Change username to this character's name before sending message
        console.log(`[username change] Changing to: ${this.name}`);
        this.courtroom.changeUsername({ username: this.name });
        
        // Wait for username change to propagate on server
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const messageData = {
            text,
            characterId: this.state.characterId,
            poseId: this.state.poseId
        };
        
        console.log(`[sending message] ${this.name}:`, messageData);
        this.courtroom.sendMessage(messageData);
        
        // Wait a bit to ensure message is sent before next operation
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}