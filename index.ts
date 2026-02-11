//objection.lol ai server

import CourtroomWebSocketClient from "./src/api/courtroom-websocket-client";
import type { MessageDto, PlainMessageDto } from "./src/api/courtroom-websocket-types";
import {
    CaseManager,
    type CaseState,
    StoryManager,
    createGenAIClient,
    generateTrialCharacters,
    generateCasePrompt,
    generateEvidence,
} from "./src/ai";
import Character from "./src/core/Character";
import { CONFIG } from "./CONFIG";

const ROOM_ID = CONFIG.roomId;
const ROOM_PASS = CONFIG.roomPass;
const PROMPT = CONFIG.prompt;
const PLAYER_USERNAME = CONFIG.playerUsername;
const MAX_AI_MESSAGES = CONFIG.maxAiMessages; // Cap AI sequential messages to prevent long runs away from player input. Judge opening counts towards this limit.
const GEMINI_KEY = CONFIG.geminiKey;
const GEMINI_MODEL = CONFIG.geminiModel;

let playerId:string; //xxxx-xxxxx-xxxxx
const aiUsernames = new Set<string>();
const aiUserIds = new Set<string>();
let aiWindowRunning = false;
let lastSpeakerId: number | null = null;
const readingDelayMs = 300; // after text animation, this will add a small delay to allow reading
let lastSpeakerName: string | null = null;

//test:
const masterCourt = new CourtroomWebSocketClient();
const genai = createGenAIClient({
    apiKey: GEMINI_KEY || "",
    model: GEMINI_MODEL
});
await Character.fetchCharacterData();

//test:
// console.log(await genai?.generateJson("What is 2+2?", {
//     type: "object",
//     properties: {
//         answer: { type: "number" },
//     },
//     required: ["answer"],
//     additionalProperties: false,
// }));
// process.exit(0);

const storyManager = new StoryManager({ cooldownMs: 15000, genai });
const caseManager = new CaseManager({ genai, storyManager });
const defaultCasePrompt = await generateCasePrompt(genai, PROMPT);
console.log("Generated case prompt:", defaultCasePrompt);
const generatedEvidence = await generateEvidence(genai, defaultCasePrompt);
console.log("Generated evidence:", generatedEvidence);
const generatedProfiles = await generateTrialCharacters(genai, defaultCasePrompt + "\n\nEvidence: " + generatedEvidence.map((e) => e.name).join(", "));
console.log("Generated character profiles:", generatedProfiles);

async function main() {
    const aiCharacters = generatedProfiles.map((profile) => ({
        profile,
        username: profile.name,
    }));

    aiCharacters.forEach((entry) => aiUsernames.add(entry.username));

    caseManager.createCase({
        storyPrompt: defaultCasePrompt,
        characters: generatedProfiles,
        evidences: generatedEvidence,
    });

    const masterSocket = masterCourt.connect({
        query: {
            username: "MasterSocket",
            roomId: ROOM_ID,
            password: ROOM_PASS
        }
    });

    masterCourt.onMessage((message) => {
        console.log("Received message:", message);
        handleIncomingPlainMessage(message);
    });

    masterCourt.onRoomUpdate((room) => {
        room.users.forEach((user) => {
            if (user.username === PLAYER_USERNAME) {
                playerId = user.id;
            }
        });
    });

    masterCourt.onUserJoined((data) => {
        if (data.username === PLAYER_USERNAME) {
            playerId = data.id;
        }
    });

    masterCourt.onUserUpdate((userId, data) => {
        if (data?.username === PLAYER_USERNAME) {
            playerId = userId;
        }
    });

    masterCourt.onTyping((userId) => {
        trackTyping(userId);
    });

    caseManager.setMasterSocket(masterCourt);

    // Post generated evidence at startup via master socket
    generatedEvidence.forEach((item, index) => {
        masterCourt.addEvidence({
            evidenceId: index + 1,
            name: item.name,
            description: item.description ?? "",
            iconUrl: item.url || "https://via.placeholder.com/128?text=Evidence",
            url: item.url ?? "",
            type: (item.type as "image" | "video") ?? "image",
        });
    });

    aiCharacters.forEach((entry) => {
        const client = new CourtroomWebSocketClient();
        client.connect({
            query: {
                username: entry.username,
                roomId: ROOM_ID,
                password: ROOM_PASS,
            },
        });

        caseManager.bindCharacterSocket(entry.profile.id, client);
    });

    // Let the Judge open the session once sockets are connected.
    setTimeout(() => {
        masterCourt.sendPlainMessage({
            text: "Storyline: " + caseManager.getCaseState().storyPrompt
        });
        void startJudgeOpening(caseManager.getCaseState());
    }, 800);

    masterCourt.onConnect(() => {
        console.log("Connected to courtroom API");

        // Refresh room roster so userId -> username map is populated for incoming messages.
        masterCourt.getRoom();

        startRepl();
    });
}

main().catch((error) => {
    console.error("Fatal error in main:", error);
});

function buildReplyPrompt(message: MessageDto, state: CaseState): string {
    return [
        "Continue the Ace Attorney style trial.",
        `Story prompt: ${state.storyPrompt}`,
        state.keyPoints.length ? `Key points: ${state.keyPoints.join(" | ")}` : "",
        `Latest player line: "${message.message}"`,
        "Respond in <=25 words, plain text, concise, keep courtroom tone.",
    ]
        .filter(Boolean)
        .join("\n");
}

async function handleIncomingPlainMessage(message: MessageDto): Promise<void> {
    if (message.message.text?.startsWith("[master]")) {
        console.log("Ignoring master message:", message.message);
        return;
    }

    if (message.userId !== playerId) {
        console.log("Ignoring message from non-player userId:", message.userId);
        return;
    }

    const username = PLAYER_USERNAME;
    console.log("Player message from", message.userId, "as", username);
    lastSpeakerId = null;

    if (aiUsernames.has(username)) {
        aiUserIds.add(message.userId);
        return;
    }

    if (aiWindowRunning) {
        console.log("AI window is already running, ignoring message.");
        return;
    }

    aiWindowRunning = true;

    storyManager.beginPlayerTurn(username, MAX_AI_MESSAGES);
    storyManager.openAiWindow(MAX_AI_MESSAGES);
    try {
        await runAiWindow(message);
    } finally {
        aiWindowRunning = false;
    }
}

async function runAiWindow(latestPlayerMessage: MessageDto): Promise<void> {
    let steps = 0;
    let lastWantsContinue = false;
    
    while (storyManager.hasAiTurnAvailable() && steps < MAX_AI_MESSAGES) {
        const state = caseManager.getCaseState();
        const candidates = state.characters.map((character) => ({
            id: character.id,
            username: character.name,
            isHuman: character.isHuman,
            isTyping: false,
        }));

        const result = await caseManager.nextBeat({
            candidates,
            lastMsg: latestPlayerMessage.message.text,
            lastSpeakerId,
            lastSpeakerName,
            lastSpeakerState: null,
            messageIndex: steps + 1,
            messageLimit: MAX_AI_MESSAGES,
            evidences: state.evidences,
            lastSpeakerWantsContinue: lastWantsContinue,
        });
        if (!result.text) {
            break;
        }

        lastSpeakerId = result.speakerId;
        lastSpeakerName = state.characters.find((c) => c.id === result.speakerId)?.name ?? null;
        lastWantsContinue = result.wantsContinue ?? false;

        console.log(`[ai delivered] ${result.speakerId ?? "unknown"}: ${result.text}${result.wantsContinue ? " (wants to continue)" : ""}`);

        // Brief pause so humans can read before the next turn
        const animationDelay = result.text.length * 60; // 60ms per character for animation
        await delay(readingDelayMs + animationDelay);

        steps += 1;
    }
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function trackTyping(userId: string): void {
    // const previousTimer = typingUsers.get(userId);
    // if (previousTimer) {
    //     clearTimeout(previousTimer);
    // }

    // // Reset typing indicator after a short idle period.
    // const timer = setTimeout(() => typingUsers.delete(userId), 5000);
    // typingUsers.set(userId, timer);
}

async function startJudgeOpening(state: CaseState): Promise<void> {
    const judge = state.characters.find((c) =>
        c.role?.toLowerCase?.() === "judge",
    );

    if (!judge) {
        return;
    }

    storyManager.openAiWindow(1);

    const prompt = [
        "Give a one-line opening to start the trial.",
        `Story prompt: ${state.storyPrompt}`,
        state.keyPoints.length ? `Key points: ${state.keyPoints.join(" | ")}` : "",
        "Tone: Judge declaring the session open briefly describing the case. <= 50 words.",
    ].filter(Boolean).join("\n");

    await caseManager.nextBeat({
        candidates: [
            {
                id: judge.id,
                username: judge.name,
                isHuman: judge.isHuman,
            },
        ],
        prompt,
        lastMsg: "",
        lastSpeakerId: judge.id,
        lastSpeakerName: judge.name,
        lastSpeakerState: null,
        evidences: state.evidences,
    });
}

function startRepl() {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.setPrompt('> ');
    rl.prompt();

    rl.on('line', async (input: string) => {
        const args = input.trim().split(/\s+/);
        const cmd = args[0];
        const cmdArgs = args.slice(1);

        if (!cmd) {
            rl.prompt();
            return;
        }

        try {
            const cmdModule = await import(`./src/repl/${cmd}.ts`);
            await cmdModule.default(cmdArgs);
        } catch (error) {
            console.error(`Error executing command "${cmd}":`, error);
        }

        rl.prompt();
    });

    rl.on('close', () => {
        process.exit(0);
    });
}