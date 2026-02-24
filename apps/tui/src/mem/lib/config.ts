import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const MEM_DIR = ".yep-mem";
const CONFIG_FILE = "config.json";

const configSchema = z.object({
	createdAt: z.string().default(""),
	embeddingModel: z.string().nullable().default(null),
	lastCodeIndexCommit: z.string().nullable().default(null),
	lastIndexedCommit: z.string().nullable().default(null),
	localSyncOffsets: z.record(z.string(), z.number()).default({}),
	ollamaBaseUrl: z.string().nullable().default(null),
	openaiApiKey: z.string().nullable().default(null),
	provider: z.enum(["openai", "ollama"]).default("openai"),
	scope: z.string().default(""),
	summarizerModel: z.string().nullable().default(null),
});

export type ProviderType = "openai" | "ollama";
export type MemConfig = z.infer<typeof configSchema>;

const DEFAULT_CONFIG = configSchema.parse({});

const EMBEDDING_DIMS: Record<string, number> = {
	"text-embedding-3-small": 1536,
	"text-embedding-3-large": 3072,
	"nomic-embed-text": 768,
	"mxbai-embed-large": 1024,
	"all-minilm": 384,
	"snowflake-arctic-embed": 1024,
};

const DEFAULT_EMBEDDING: Record<ProviderType, string> = {
	openai: "text-embedding-3-small",
	ollama: "nomic-embed-text",
};

const DEFAULT_SUMMARIZER: Record<ProviderType, string> = {
	openai: "gpt-4o-mini",
	ollama: "llama3.1:8b",
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

let cachedConfig: MemConfig | null = null;

export function readConfig(): MemConfig {
	if (cachedConfig) {
		return cachedConfig;
	}
	const path = getConfigPath();
	if (!existsSync(path)) {
		return { ...DEFAULT_CONFIG };
	}
	try {
		const raw: unknown = JSON.parse(readFileSync(path, "utf-8"));
		cachedConfig = configSchema.parse(raw);
		return cachedConfig;
	} catch {
		return { ...DEFAULT_CONFIG };
	}
}

export function writeConfig(config: MemConfig): void {
	ensureMemDir();
	writeFileSync(getConfigPath(), JSON.stringify(config, null, "\t"));
	cachedConfig = config;
}

export function updateConfig(partial: Partial<MemConfig>): void {
	const current = readConfig();
	writeConfig({ ...current, ...partial });
}

export function invalidateConfigCache(): void {
	cachedConfig = null;
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

export function getProvider(): ProviderType {
	return readConfig().provider;
}

export function getEmbeddingModel(): string {
	const config = readConfig();
	return config.embeddingModel ?? DEFAULT_EMBEDDING[config.provider];
}

export function getSummarizerModel(): string {
	const config = readConfig();
	return config.summarizerModel ?? DEFAULT_SUMMARIZER[config.provider];
}

export function getOllamaBaseUrl(): string {
	const config = readConfig();
	return config.ollamaBaseUrl ?? "http://localhost:11434/api";
}

export function getVectorDimensions(): number {
	const model = getEmbeddingModel();
	return EMBEDDING_DIMS[model] ?? 1536;
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

export function ensureProviderReady(): void {
	const config = readConfig();
	if (config.provider === "openai") {
		ensureOpenAIKey();
	}
}

export function isOllamaProvider(): boolean {
	return readConfig().provider === "ollama";
}
