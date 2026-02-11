const DEFAULTS = {
    roomId: "jx4r64",
    roomPass: undefined,
    prompt: `
    Be funny, but try to make sense. Create a never seen storyline for a murder
    case in Ace Attorney.
`,
    playerUsername: "eduapps",
    maxAiMessages: 4,
    geminiModel: "gemini-3-flash-preview", //gemini-2.5-flash, gemini-3-pro-preview
};

function printHelp(): void {
    const helpText = `
Usage: node index.ts [options]

Options:
  --room-id <id>          Courtroom room id (default: ${DEFAULTS.roomId})
  --room-pass <pass>      Courtroom room password (default: ${DEFAULTS.roomPass})
  --prompt <text>         Story prompt (default: built-in prompt)
  --player-username <id>  Human player username (default: ${DEFAULTS.playerUsername})
  --max-ai-messages <n>   Max sequential AI messages (default: ${DEFAULTS.maxAiMessages})
  --gemini-key <key>      Gemini API key
  --gemini-model <id>     Gemini model id (default: ${DEFAULTS.geminiModel})
  -h, --help              Show this help

Examples:
  node index.ts --room-id 22p3ya --room-pass passwording
  node index.ts --prompt "New case prompt" --max-ai-messages 3
`;

    console.log(helpText.trim());
}

function parseArgs(argv: string[]) {
    const args: Record<string, string | boolean> = {};
    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i] || '';
        if (!token.startsWith("-")) {
            continue;
        }

        if (token === "-h" || token === "--help") {
            args.help = true;
            continue;
        }

        const key = token.replace(/^--?/, "");
        const next = argv[i + 1];
        if (!next || next.startsWith("-")) {
            args[key] = true;
            continue;
        }

        args[key] = next;
        i += 1;
    }

    return args;
}

const cliArgs = parseArgs(process.argv.slice(2));
if (cliArgs.help) {
    printHelp();
    process.exit(0);
}

// Validate required arguments
const missingArgs: string[] = [];
if (!cliArgs["room-id"]) missingArgs.push("--room-id");
if (!cliArgs["player-username"]) missingArgs.push("--player-username");
if (!cliArgs["gemini-key"] && !process.env.GEMINI_KEY) missingArgs.push("--gemini-key");

if (missingArgs.length > 0) {
    console.error(`\nMissing required arguments: ${missingArgs.join(", ")}\n\nExample usage:\nobjection-ai --room-id XXXX --player-username XXXXX --gemini-key YOUR_KEY_HERE --prompt "New case prompt here..."\n`);
    printHelp();
    process.exit(1);
}

const CONFIG = {
    roomId: (cliArgs["room-id"] as string) || DEFAULTS.roomId,
    roomPass: (cliArgs["room-pass"] as string) || DEFAULTS.roomPass,
    prompt: (cliArgs.prompt as string) || DEFAULTS.prompt,
    playerUsername: (cliArgs["player-username"] as string) || DEFAULTS.playerUsername,
    maxAiMessages: Number(cliArgs["max-ai-messages"]) || DEFAULTS.maxAiMessages,
    geminiKey: (cliArgs["gemini-key"] as string) || process.env.GEMINI_KEY,
    geminiModel: (cliArgs["gemini-model"] as string) || DEFAULTS.geminiModel,
};

export { CONFIG, DEFAULTS };
