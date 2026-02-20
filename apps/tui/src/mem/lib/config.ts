import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MEM_DIR = ".yep-mem";
const CONFIG_FILE = "config.json";

export interface MemConfig {
	createdAt: string;
	embeddingModel: string | null;
	lastIndexedCommit: string | null;
	localSyncOffsets: Record<string, number>;
	openaiApiKey: string | null;
}

const DEFAULT_CONFIG: MemConfig = {
	createdAt: "",
	embeddingModel: null,
	lastIndexedCommit: null,
	localSyncOffsets: {},
	openaiApiKey: null,
};

function getMemDir(): string {
	return join(process.cwd(), MEM_DIR);
}

export function getStorePath(): string {
	return join(getMemDir(), "vectors");
}

export function ensureMemDir(): void {
	const dir = getMemDir();
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

function getConfigPath(): string {
	return join(getMemDir(), CONFIG_FILE);
}

export function readConfig(): MemConfig {
	const path = getConfigPath();
	if (!existsSync(path)) {
		return { ...DEFAULT_CONFIG };
	}
	const raw = JSON.parse(readFileSync(path, "utf-8")) as Partial<MemConfig>;
	return { ...DEFAULT_CONFIG, ...raw };
}

export function writeConfig(config: MemConfig): void {
	ensureMemDir();
	writeFileSync(getConfigPath(), JSON.stringify(config, null, "\t"));
}

export function updateConfig(partial: Partial<MemConfig>): void {
	const current = readConfig();
	writeConfig({ ...current, ...partial });
}

export function isInitialized(): boolean {
	return existsSync(getMemDir()) && existsSync(getConfigPath());
}

export function getLocalSyncOffset(sessionName: string): number {
	const config = readConfig();
	return config.localSyncOffsets[sessionName] ?? 0;
}

export function setLocalSyncOffset(sessionName: string, offset: number): void {
	const config = readConfig();
	config.localSyncOffsets[sessionName] = offset;
	writeConfig(config);
}

export function getEmbeddingModel(): string {
	const config = readConfig();
	return config.embeddingModel ?? "text-embedding-3-small";
}

function readCursorMcpKey(): string | null {
	const candidates = [
		join(process.cwd(), ".cursor", "mcp.json"),
		join(getMemDir(), "..", ".cursor", "mcp.json"),
	];

	for (const mcpPath of candidates) {
		if (!existsSync(mcpPath)) {
			continue;
		}
		try {
			const raw = JSON.parse(readFileSync(mcpPath, "utf-8")) as {
				mcpServers?: {
					"yep-mem"?: { env?: { OPENAI_API_KEY?: string } };
				};
			};
			const key = raw.mcpServers?.["yep-mem"]?.env?.OPENAI_API_KEY;
			if (key && key.length > 0) {
				return key;
			}
		} catch {
			// malformed mcp.json
		}
	}
	return null;
}

export function resolveOpenAIKey(): string | null {
	if (process.env.OPENAI_API_KEY) {
		return process.env.OPENAI_API_KEY;
	}

	const fromConfig = readConfig().openaiApiKey;
	if (fromConfig) {
		return fromConfig;
	}

	return readCursorMcpKey();
}

export function ensureOpenAIKey(): string {
	const key = resolveOpenAIKey();
	if (!key) {
		console.error("OPENAI_API_KEY not found.");
		console.error(
			"Set it via: environment variable, .yep-mem/config.json, or .cursor/mcp.json"
		);
		process.exit(1);
	}
	process.env.OPENAI_API_KEY = key;
	return key;
}
