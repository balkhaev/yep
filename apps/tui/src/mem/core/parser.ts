import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { getLocalSyncOffset, setLocalSyncOffset } from "../lib/config.ts";
import { checkpointBranchExists, getFileAtCommit } from "../lib/git.ts";

const CHECKPOINT_ID_PATTERN = /^([0-9a-f]{2})\/([0-9a-f]{10})\//;
const SESSION_INDEX_PATTERN = /^(\d+)\//;

export interface SessionTranscriptEntry {
	content: string;
	role: "user" | "assistant" | "system" | "tool";
}

export interface SessionMetadata {
	agent?: string;
	attribution?: {
		agentPercentage?: number;
		humanPercentage?: number;
	};
	tokenUsage?: {
		inputTokens?: number;
		outputTokens?: number;
		totalTokens?: number;
	};
	[key: string]: unknown;
}

export interface CheckpointMetadata {
	branch?: string;
	commitHash?: string;
	id: string;
	timestamp?: string;
	[key: string]: unknown;
}

export interface ParsedSession {
	checkpointId: string;
	metadata: SessionMetadata;
	prompts: string;
	sessionIndex: number;
	transcript: SessionTranscriptEntry[];
}

export interface ParsedCheckpoint {
	id: string;
	metadata: CheckpointMetadata;
	sessions: ParsedSession[];
}

interface RawContentItem {
	text?: string;
	type?: string;
}

interface RawJsonlEntry {
	content?: unknown;
	message?: {
		content?: unknown;
	};
	role?: string;
}

async function exec(cmd: string): Promise<string> {
	const proc = Bun.spawn(["sh", "-c", cmd], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const output = await new Response(proc.stdout).text();
	await proc.exited;
	return output.trim();
}

function extractTextContent(raw: unknown): string {
	if (typeof raw === "string") {
		return raw;
	}

	if (Array.isArray(raw)) {
		return (raw as RawContentItem[])
			.filter((item) => item.type === "text" && typeof item.text === "string")
			.map((item) => item.text as string)
			.join("\n");
	}

	if (raw && typeof raw === "object" && "text" in raw) {
		return String((raw as { text: unknown }).text);
	}

	return typeof raw === "undefined" ? "" : JSON.stringify(raw);
}

function normalizeEntry(raw: RawJsonlEntry): SessionTranscriptEntry | null {
	const role = raw.role as SessionTranscriptEntry["role"] | undefined;
	if (!role) {
		return null;
	}

	const messageContent = raw.message?.content;
	const directContent = raw.content;
	const content = extractTextContent(messageContent ?? directContent);

	return { role, content };
}

function parseJsonl(content: string): SessionTranscriptEntry[] {
	return content
		.split("\n")
		.filter(Boolean)
		.map((line) => {
			try {
				const raw = JSON.parse(line) as RawJsonlEntry;
				return normalizeEntry(raw);
			} catch {
				return null;
			}
		})
		.filter((entry): entry is SessionTranscriptEntry => entry !== null);
}

async function listTreePaths(branch: string): Promise<string[]> {
	const output = await exec(
		`git ls-tree -r --name-only ${branch} 2>/dev/null || true`
	);
	return output ? output.split("\n").filter(Boolean) : [];
}

function extractCheckpointIds(paths: string[]): string[] {
	const ids = new Set<string>();
	for (const p of paths) {
		const match = p.match(CHECKPOINT_ID_PATTERN);
		if (match?.[1] && match[2]) {
			ids.add(`${match[1]}${match[2]}`);
		}
	}
	return [...ids];
}

function findSessionIndices(paths: string[], checkpointId: string): number[] {
	const shard = checkpointId.slice(0, 2);
	const rest = checkpointId.slice(2);
	const prefix = `${shard}/${rest}/`;

	const indices = new Set<number>();
	for (const p of paths) {
		if (p.startsWith(prefix)) {
			const sub = p.slice(prefix.length);
			const sessionMatch = sub.match(SESSION_INDEX_PATTERN);
			if (sessionMatch?.[1]) {
				indices.add(Number.parseInt(sessionMatch[1], 10));
			}
		}
	}
	return [...indices].sort((a, b) => a - b);
}

function checkpointFilePath(
	checkpointId: string,
	...segments: string[]
): string {
	const shard = checkpointId.slice(0, 2);
	const rest = checkpointId.slice(2);
	return [shard, rest, ...segments].join("/");
}

async function safeReadFile(
	branch: string,
	path: string
): Promise<string | null> {
	try {
		return await getFileAtCommit(branch, path);
	} catch {
		return null;
	}
}

function safeReadLocalFile(path: string): string | null {
	try {
		if (!existsSync(path)) {
			return null;
		}
		return readFileSync(path, "utf-8");
	} catch {
		return null;
	}
}

async function parseCheckpointsFromBranch(
	knownIds?: Set<string>
): Promise<ParsedCheckpoint[]> {
	const branch = "entire/checkpoints/v1";

	if (!(await checkpointBranchExists())) {
		return [];
	}

	const allPaths = await listTreePaths(branch);
	const checkpointIds = extractCheckpointIds(allPaths);
	const newIds = knownIds
		? checkpointIds.filter((id) => !knownIds.has(id))
		: checkpointIds;

	const checkpoints: ParsedCheckpoint[] = [];

	for (const cpId of newIds) {
		const metaRaw = await safeReadFile(
			branch,
			checkpointFilePath(cpId, "metadata.json")
		);
		const cpMeta: CheckpointMetadata = metaRaw
			? { id: cpId, ...(JSON.parse(metaRaw) as Record<string, unknown>) }
			: { id: cpId };

		const sessionIndices = findSessionIndices(allPaths, cpId);
		const sessions: ParsedSession[] = [];

		for (const idx of sessionIndices) {
			const dir = String(idx);
			const [transcriptRaw, promptsRaw, sessionMetaRaw] = await Promise.all([
				safeReadFile(branch, checkpointFilePath(cpId, dir, "full.jsonl")),
				safeReadFile(branch, checkpointFilePath(cpId, dir, "prompt.txt")),
				safeReadFile(branch, checkpointFilePath(cpId, dir, "metadata.json")),
			]);

			sessions.push({
				checkpointId: cpId,
				sessionIndex: idx,
				prompts: promptsRaw ?? "",
				transcript: transcriptRaw ? parseJsonl(transcriptRaw) : [],
				metadata: sessionMetaRaw
					? (JSON.parse(sessionMetaRaw) as SessionMetadata)
					: {},
			});
		}

		checkpoints.push({ id: cpId, metadata: cpMeta, sessions });
	}

	return checkpoints;
}

function readLocalJsonlIncremental(
	filePath: string,
	sessionName: string
): { transcript: SessionTranscriptEntry[]; newOffset: number } | null {
	if (!existsSync(filePath)) {
		return null;
	}

	const lastOffset = getLocalSyncOffset(sessionName);
	let stat: ReturnType<typeof statSync>;
	try {
		stat = statSync(filePath);
	} catch {
		return null;
	}

	const fileSize = stat.size;
	if (fileSize <= lastOffset) {
		return null;
	}

	const content = readFileSync(filePath, "utf-8");
	const transcript = parseJsonl(content);

	return { transcript, newOffset: fileSize };
}

function parseLocalSessions(): ParsedCheckpoint[] {
	const entireDir = join(process.cwd(), ".entire", "metadata");
	if (!existsSync(entireDir)) {
		return [];
	}

	const checkpoints: ParsedCheckpoint[] = [];

	let sessionDirs: string[];
	try {
		sessionDirs = readdirSync(entireDir);
	} catch {
		return [];
	}

	for (const sessionName of sessionDirs) {
		const localId = `local-${sessionName}`;
		const sessionDir = join(entireDir, sessionName);
		const jsonlPath = join(sessionDir, "full.jsonl");

		const result = readLocalJsonlIncremental(jsonlPath, sessionName);
		if (!result || result.transcript.length === 0) {
			continue;
		}

		setLocalSyncOffset(sessionName, result.newOffset);

		const promptsRaw = safeReadLocalFile(join(sessionDir, "prompt.txt"));
		const metaRaw = safeReadLocalFile(join(sessionDir, "metadata.json"));

		const metadata: SessionMetadata = metaRaw
			? (JSON.parse(metaRaw) as SessionMetadata)
			: {};

		checkpoints.push({
			id: localId,
			metadata: { id: localId, timestamp: new Date().toISOString() },
			sessions: [
				{
					checkpointId: localId,
					sessionIndex: 0,
					prompts: promptsRaw ?? "",
					transcript: result.transcript,
					metadata,
				},
			],
		});
	}

	return checkpoints;
}

export async function parseAllCheckpoints(
	knownIds?: Set<string>
): Promise<ParsedCheckpoint[]> {
	const [branchCheckpoints, localCheckpoints] = await Promise.all([
		parseCheckpointsFromBranch(knownIds),
		Promise.resolve(parseLocalSessions()),
	]);

	return [...branchCheckpoints, ...localCheckpoints];
}
