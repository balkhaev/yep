import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { initStore } from "../core/store.ts";
import {
	ensureMemDir,
	isInitialized,
	type ProviderType,
	resolveOpenAIKey,
	writeConfig,
} from "../lib/config.ts";
import { checkpointBranchExists } from "../lib/git.ts";

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";

async function exec(cmd: string): Promise<{ ok: boolean; output: string }> {
	const proc = Bun.spawn(["sh", "-c", cmd], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const output = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();
	const exitCode = await proc.exited;
	return {
		ok: exitCode === 0,
		output: exitCode === 0 ? output.trim() : stderr.trim(),
	};
}

async function execInteractive(cmd: string): Promise<boolean> {
	const proc = Bun.spawn(["sh", "-c", cmd], {
		stdout: "inherit",
		stderr: "inherit",
		stdin: "inherit",
	});
	return (await proc.exited) === 0;
}

function ok(msg: string): void {
	console.log(`  ${GREEN}✓${RESET} ${msg}`);
}

function info(msg: string): void {
	console.log(`  ${CYAN}→${RESET} ${msg}`);
}

function skipped(msg: string): void {
	console.log(`  ${DIM}- ${msg}${RESET}`);
}

function warning(msg: string): void {
	console.log(`  ${YELLOW}!${RESET} ${msg}`);
}

function hint(msg: string): void {
	console.log(`    ${DIM}${msg}${RESET}`);
}

function setupMemDir(): void {
	if (isInitialized()) {
		skipped(".yep-mem/ already exists");
	} else {
		ensureMemDir();
		ok("Created .yep-mem/");
	}
}

async function setupEntire(
	repoRoot: string
): Promise<{ ready: boolean; version: string }> {
	const { ok: installed, output: rawVersion } = await exec("entire version");
	const version = rawVersion.split("\n")[0] ?? rawVersion;

	if (!installed) {
		warning("Entire CLI not found");
		hint("brew install entireio/tap/entire");
		hint("curl -fsSL https://entire.io/install.sh | bash");
		return { ready: false, version: "" };
	}

	if (existsSync(join(repoRoot, ".entire"))) {
		skipped(`Entire already enabled ${DIM}(${version})${RESET}`);
		return { ready: true, version };
	}

	ok(`Entire found ${DIM}(${version})${RESET}`);
	console.log("");
	const success = await execInteractive("entire enable");
	console.log("");

	if (success) {
		ok("Entire enabled");
		return { ready: true, version };
	}

	warning("Entire setup skipped (run 'entire enable' manually)");
	return { ready: false, version };
}

async function setupVectorStore(): Promise<void> {
	try {
		await initStore();
		ok("Vector store initialized");
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		warning(`Vector store: ${msg}`);
	}
}

function setupGitignore(repoRoot: string): void {
	const path = join(repoRoot, ".gitignore");
	const marker = ".yep-mem";

	if (existsSync(path)) {
		const content = readFileSync(path, "utf-8");
		if (content.includes(marker)) {
			skipped(".gitignore already configured");
			return;
		}
		writeFileSync(path, `${content.trimEnd()}\n\n# yep memory\n${marker}\n`);
	} else {
		writeFileSync(path, `# yep memory\n${marker}\n`);
	}
	ok("Added .yep-mem to .gitignore");
}

function setupLefthook(repoRoot: string): void {
	const path = join(repoRoot, "lefthook.yml");
	const marker = "yep-mem-sync";
	const block = [
		"post-commit:",
		"  jobs:",
		"    - name: yep-mem-sync",
		"      run: yep sync 2>/dev/null || true",
	].join("\n");

	if (!existsSync(path)) {
		writeFileSync(path, `${block}\n`);
		ok("Added post-commit hook to lefthook.yml");
		return;
	}

	const content = readFileSync(path, "utf-8");
	if (content.includes(marker)) {
		skipped("Post-commit hook already configured");
		return;
	}

	writeFileSync(path, `${content.trimEnd()}\n\n${block}\n`);
	ok("Added post-commit hook to lefthook.yml");
}

function setupCursorMcp(repoRoot: string): void {
	const cursorDir = join(repoRoot, ".cursor");
	const mcpPath = join(cursorDir, "mcp.json");

	if (!existsSync(cursorDir)) {
		Bun.spawnSync(["mkdir", "-p", cursorDir]);
	}

	const entry = {
		command: "yep",
		args: ["serve"],
		env: { OPENAI_API_KEY: "" },
	};

	if (!existsSync(mcpPath)) {
		writeFileSync(
			mcpPath,
			JSON.stringify({ mcpServers: { "yep-mem": entry } }, null, "\t")
		);
		ok("Registered MCP server in .cursor/mcp.json");
		return;
	}

	const content = JSON.parse(readFileSync(mcpPath, "utf-8")) as {
		mcpServers?: Record<string, unknown>;
	};
	if (content.mcpServers?.["yep-mem"]) {
		skipped("MCP server already registered");
		return;
	}

	content.mcpServers = { ...content.mcpServers, "yep-mem": entry };
	writeFileSync(mcpPath, JSON.stringify(content, null, "\t"));
	ok("Registered MCP server in .cursor/mcp.json");
}

const YEP_MEMORY_RULE = `---
description: "Agent rules for projects using yep-mem (agent memory). Automatically installed by yep enable."
globs: "**/*"
alwaysApply: true
---

# yep-mem: Agent Memory

This project uses **yep-mem** for persistent agent memory. Follow these guidelines:

## Before Starting Any Task

1. Call \`search_solutions\` with a description of what you're about to do
2. Call \`search_all\` if you need both code context and past session history
3. Review returned past solutions for relevant patterns, pitfalls, and decisions

## Before Editing a Function or Class

1. Call \`symbol_context\` with the symbol name to understand:
   - What calls this symbol (callers)
   - What this symbol calls (callees)
   - Who imports it
   - Past sessions that touched it
2. Consider the blast radius before making changes

## Before Committing

1. Call \`detect_changes\` to see which symbols your changes affect
2. Review the blast radius and past session warnings
3. Ensure you haven't broken callers or dependents

## Available MCP Tools

- \`search_solutions\` — Search past AI coding sessions
- \`search_all\` — Unified search across sessions + indexed code
- \`symbol_context\` — 360-degree view of a code symbol
- \`detect_changes\` — Git diff → affected symbols → blast radius
- \`mem_stats\` — Memory store statistics
`;

function setupAgentRules(repoRoot: string): void {
	const rulesDir = join(repoRoot, ".cursor", "rules");
	const rulePath = join(rulesDir, "yep-memory.mdc");

	if (existsSync(rulePath)) {
		const existing = readFileSync(rulePath, "utf-8");
		if (existing.includes("yep-mem")) {
			skipped("Agent rules already installed");
			return;
		}
	}

	mkdirSync(rulesDir, { recursive: true });
	writeFileSync(rulePath, YEP_MEMORY_RULE);
	ok("Installed agent rules in .cursor/rules/yep-memory.mdc");
}

async function runInitialSync(): Promise<void> {
	const { chunkCheckpoints } = await import("../core/chunker.ts");
	const { embedTexts } = await import("../core/embedder.ts");
	const { parseAllCheckpoints } = await import("../core/parser.ts");
	const { getIndexedChunkIds, insertChunks } = await import("../core/store.ts");

	const existingIds = await getIndexedChunkIds();
	const knownCpIds = new Set<string>();
	for (const id of existingIds) {
		const cpId = id.split("-").slice(0, -2).join("-");
		if (cpId) {
			knownCpIds.add(cpId);
		}
	}

	const checkpoints = await parseAllCheckpoints(knownCpIds);
	if (checkpoints.length === 0) {
		skipped("No new checkpoints to index");
		return;
	}

	const chunks = chunkCheckpoints(checkpoints);
	const newChunks = chunks.filter((c) => !existingIds.has(c.id));
	if (newChunks.length === 0) {
		skipped("All checkpoints already indexed");
		return;
	}

	info(`Embedding ${newChunks.length} chunk(s)...`);
	const vectors = await embedTexts(newChunks.map((c) => c.embeddingText));
	const inserted = await insertChunks(newChunks, vectors);
	ok(`Indexed ${inserted} chunk(s) from ${checkpoints.length} checkpoint(s)`);
}

function printSummary(): void {
	console.log("");
	console.log(
		`  ${GREEN}${BOLD}Your agent is now enhanced with memory.${RESET}`
	);
	console.log("");
	console.log(
		`  ${DIM}Every commit is automatically indexed. Before each task,${RESET}`
	);
	console.log(
		`  ${DIM}your agent retrieves relevant past solutions via MCP.${RESET}`
	);
	console.log("");
	console.log(`  ${BOLD}How it works:${RESET}`);
	console.log(
		`    ${DIM}1.${RESET} Entire captures AI sessions as checkpoints`
	);
	console.log(
		`    ${DIM}2.${RESET} Post-commit hook indexes them into a vector store`
	);
	console.log(
		`    ${DIM}3.${RESET} Agents call ${CYAN}search_solutions${RESET} via MCP to get context`
	);
	console.log("");
	console.log(`  ${BOLD}Commands:${RESET}`);
	console.log(
		`    ${CYAN}yep sync${RESET}          ${DIM}Index new checkpoints manually${RESET}`
	);
	console.log(
		`    ${CYAN}yep search "..."${RESET}  ${DIM}Search past solutions${RESET}`
	);
	console.log(
		`    ${CYAN}yep serve${RESET}         ${DIM}Start MCP server (auto in Cursor)${RESET}`
	);
	console.log("");
}

function detectProvider(): ProviderType {
	const envProvider = process.env.YEP_PROVIDER;
	if (envProvider === "ollama") {
		return "ollama";
	}
	if (envProvider === "openai") {
		return "openai";
	}

	if (resolveOpenAIKey()) {
		return "openai";
	}

	const { exitCode } = Bun.spawnSync(["sh", "-c", "ollama list 2>/dev/null"]);
	if (exitCode === 0) {
		return "ollama";
	}

	return "openai";
}

export async function enableCommand(): Promise<void> {
	console.log("");
	console.log(
		`  ${BOLD}yep${RESET} ${DIM}— agent memory for your codebase${RESET}`
	);
	console.log("");

	const repoRoot = await exec("git rev-parse --show-toplevel").then((r) => {
		if (!r.ok) {
			throw new Error("Not in a git repository");
		}
		return r.output;
	});

	setupMemDir();
	const entire = await setupEntire(repoRoot);
	await setupVectorStore();
	setupGitignore(repoRoot);
	setupLefthook(repoRoot);
	setupCursorMcp(repoRoot);
	setupAgentRules(repoRoot);

	const provider = detectProvider();
	const apiKey = provider === "openai" ? resolveOpenAIKey() : null;

	writeConfig({
		createdAt: new Date().toISOString(),
		embeddingModel: null,
		lastCodeIndexCommit: null,
		lastIndexedCommit: null,
		localSyncOffsets: {},
		ollamaBaseUrl: null,
		openaiApiKey: apiKey ?? null,
		provider,
		scope: "",
		summarizerModel: null,
	});

	if (provider === "ollama") {
		ok("Using Ollama (local models, no API key needed)");
		hint("Embedding: nomic-embed-text | Summarizer: llama3.1:8b");
		hint("Make sure Ollama is running: ollama serve");
	} else if (apiKey) {
		ok("OpenAI API key found");
		process.env.OPENAI_API_KEY = apiKey;
	} else {
		warning("OPENAI_API_KEY not set");
		hint("Add it to .cursor/mcp.json or export before sync");
		hint(
			"Or switch to local models: set provider to 'ollama' in .yep-mem/config.json"
		);
	}

	if (entire.ready && apiKey && (await checkpointBranchExists())) {
		console.log("");
		info("Found existing checkpoints, syncing...");
		try {
			await runInitialSync();
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			warning(`Initial sync failed: ${msg}`);
		}
	}

	if (apiKey || provider === "ollama") {
		console.log("");
		info("Indexing code symbols...");
		try {
			const { runCodeIndex } = await import("./index-code.ts");
			const result = await runCodeIndex((msg) => info(msg));
			if (result.skipped) {
				skipped("No code files to index");
			} else {
				ok(
					`Indexed ${result.totalSymbols} symbols from ${result.totalFiles} files`
				);
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			warning(`Code indexing failed: ${msg}`);
			hint("You can run 'yep index-code' manually later");
		}
	}

	printSummary();
}
