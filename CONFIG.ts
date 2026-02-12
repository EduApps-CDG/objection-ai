const DEFAULTS = {
    roomId: undefined,
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
  --room-id <id>          Courtroom room id (required)
  --room-pass <pass>      Courtroom room password (optional)
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

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
};

async function promptUser(question: string, defaultValue?: string): Promise<string> {
    const readline = await import('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        const prompt = defaultValue 
            ? `${colors.cyan}${question}${colors.reset} ${colors.yellow}[${defaultValue}]${colors.reset}: `
            : `${colors.cyan}${question}${colors.reset}: `;
            
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer.trim() || defaultValue || '');
        });
    });
}

async function interactiveSetup(): Promise<Record<string, string>> {
    console.log(`\n${colors.bright}${colors.magenta}════════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}       Welcome to Objection.ai - Interactive Setup${colors.reset}`);
    console.log(`${colors.bright}${colors.magenta}════════════════════════════════════════════════════════════════${colors.reset}\n`);
    
    console.log(`${colors.yellow}Step 1:${colors.reset} Create a room at ${colors.blue}${colors.bright}https://objection.lol/courtroom/${colors.reset}`);
    console.log(`${colors.yellow}Step 2:${colors.reset} Answer the following questions:\n`);

    const config: Record<string, string> = {};
    
    config['room-id'] = await promptUser('Enter room ID');
    config['player-username'] = await promptUser('Enter your username', DEFAULTS.playerUsername);
    config['room-pass'] = await promptUser('Enter room password (optional, press Enter to skip)', '');
    config['gemini-key'] = await promptUser('Enter your Gemini API key', process.env.GEMINI_KEY || '');
    config['gemini-model'] = await promptUser('Enter Gemini model', DEFAULTS.geminiModel);
    
    const useDefaultPrompt = await promptUser(`Use default prompt? (y/n)`, 'y');
    if (useDefaultPrompt.toLowerCase() === 'y' || useDefaultPrompt === '') {
        config['prompt'] = DEFAULTS.prompt;
    } else {
        config['prompt'] = await promptUser('Enter custom story prompt', DEFAULTS.prompt);
    }
    
    config['max-ai-messages'] = await promptUser('Max AI messages per turn', DEFAULTS.maxAiMessages.toString());

    console.log(`\n${colors.green}${colors.bright}✓ Configuration complete!${colors.reset}\n`);
    
    return config;
}

// Check if any required arguments are missing
const hasRoomId = cliArgs["room-id"];
const hasPlayerUsername = cliArgs["player-username"];
const hasGeminiKey = cliArgs["gemini-key"] || process.env.GEMINI_KEY;

let finalConfig: Record<string, string | boolean>;

// If no arguments provided or missing required ones, run interactive setup
if (!hasRoomId || !hasPlayerUsername || !hasGeminiKey) {
    if (process.argv.length <= 2) {
        // No arguments at all, run interactive setup
        finalConfig = await interactiveSetup();
    } else {
        // Some arguments provided but missing required ones
        const missingArgs: string[] = [];
        if (!hasRoomId) missingArgs.push("--room-id");
        if (!hasPlayerUsername) missingArgs.push("--player-username");
        if (!hasGeminiKey) missingArgs.push("--gemini-key");
        
        console.error(`\n${colors.red}${colors.bright}Missing required arguments:${colors.reset} ${missingArgs.join(", ")}\n`);
        console.log(`${colors.yellow}Tip:${colors.reset} Run without arguments for interactive setup, or use:\n`);
        console.log(`${colors.cyan}objection-ai --room-id XXXX --player-username XXXXX --gemini-key YOUR_KEY_HERE${colors.reset}\n`);
        printHelp();
        process.exit(1);
    }
} else {
    finalConfig = cliArgs;
}

const CONFIG = {
    roomId: (finalConfig["room-id"] as string) || DEFAULTS.roomId,
    roomPass: (finalConfig["room-pass"] as string) || DEFAULTS.roomPass,
    prompt: (finalConfig.prompt as string) || DEFAULTS.prompt,
    playerUsername: (finalConfig["player-username"] as string) || DEFAULTS.playerUsername,
    maxAiMessages: Number(finalConfig["max-ai-messages"]) || DEFAULTS.maxAiMessages,
    geminiKey: (finalConfig["gemini-key"] as string) || process.env.GEMINI_KEY,
    geminiModel: (finalConfig["gemini-model"] as string) || DEFAULTS.geminiModel,
};

export { CONFIG, DEFAULTS };
