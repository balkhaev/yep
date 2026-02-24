import { createHash } from "node:crypto";
import {
	ensureProviderReady,
	readConfig,
	updateConfig,
} from "../lib/config.ts";
import { requireInit } from "../lib/guards.ts";
import { withSyncLock } from "../lib/lock.ts";
import { clearCache } from "./cache.ts";
import type { SolutionChunk } from "./chunker.ts";
import { chunkCheckpoints } from "./chunker.ts";
import { embedTexts } from "./embedder.ts";
import type { ParsedCheckpoint } from "./parser.ts";
import { parseAllCheckpoints } from "./parser.ts";
import {
	ensureFtsIndex,
	getContentHash,
	getIndexedChunkIds,
	insertChunks,
	upsertChunks,
} from "./store.ts";
import { summarizeChunks } from "./summarizer.ts";

export interface SyncProgress {
	message: string;
	step: string;
}

export interface SyncResult {
	totalInserted: number;
}

type ProgressFn = (step: string, message: string) => void | Promise<void>;

const isLocal = (id: string) => id.startsWith("local-");

function hashContent(content: string): string {
	return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function extractCheckpointIds(existingIds: Set<string>): Set<string> {
	const cpIds = new Set<string>();
	for (const id of existingIds) {
		const cpId = id.split("-").slice(0, -2).join("-");
		if (cpId) {
			cpIds.add(cpId);
		}
	}
	return cpIds;
}

interface CheckpointWithHash extends ParsedCheckpoint {
	_contentHash: string;
}

async function findChangedLocals(
	localCheckpoints: ParsedCheckpoint[]
): Promise<CheckpointWithHash[]> {
	const changed: CheckpointWithHash[] = [];
	for (const cp of localCheckpoints) {
		const rawContent = cp.sessions
			.map((s) => s.transcript.map((t) => t.content).join(""))
			.join("");
		const hash = hashContent(rawContent);
		const existingHash = await getContentHash(cp.id);
		if (existingHash !== hash) {
			changed.push(Object.assign(cp, { _contentHash: hash }));
		}
	}
	return changed;
}

async function applySummaries(
	chunks: SolutionChunk[],
	onProgress?: ProgressFn
): Promise<void> {
	await onProgress?.("summarizing", `Summarizing ${chunks.length} chunk(s)...`);
	const summaries = await summarizeChunks(
		chunks.map((c) => ({
			prompt: c.prompt,
			response: c.response,
			diffSummary: c.diffSummary,
		})),
		(done, total) => {
			onProgress?.("summarizing", `Summarizing ${done}/${total}...`);
		}
	);

	for (let i = 0; i < chunks.length; i++) {
		const chunk = chunks[i];
		const summary = summaries[i];
		if (chunk && summary) {
			chunk.summary = summary;
			chunk.embeddingText = `${summary}\n\n${chunk.embeddingText}`;
		}
	}
}

async function indexChunks(
	allChunks: SolutionChunk[],
	vectors: number[][],
	changedLocals: CheckpointWithHash[]
): Promise<number> {
	const newChunks = allChunks.filter((c) => !isLocal(c.checkpointId));
	const localChunks = allChunks.filter((c) => isLocal(c.checkpointId));
	let total = 0;

	if (newChunks.length > 0) {
		total += await insertChunks(newChunks, vectors.slice(0, newChunks.length));
	}

	if (localChunks.length > 0) {
		const localVectors = vectors.slice(newChunks.length);
		for (const cp of changedLocals) {
			const cpChunks = localChunks.filter((c) => c.checkpointId === cp.id);
			if (cpChunks.length === 0) {
				continue;
			}
			const first = cpChunks[0];
			if (!first) {
				continue;
			}
			const startIdx = localChunks.indexOf(first);
			const cpVectors = localVectors.slice(
				startIdx,
				startIdx + cpChunks.length
			);
			total += await upsertChunks(cpChunks, cpVectors, cp._contentHash);
		}
	}

	return total;
}

export async function runSync(onProgress?: ProgressFn): Promise<SyncResult> {
	requireInit();
	ensureProviderReady();

	return await withSyncLock(async () => {
		await onProgress?.("parsing", "Parsing checkpoints...");

		const existingCpIds = extractCheckpointIds(await getIndexedChunkIds());
		const checkpoints = await parseAllCheckpoints();

		if (checkpoints.length === 0) {
			return { totalInserted: 0 };
		}

		const newCheckpoints = checkpoints.filter(
			(cp) => !(existingCpIds.has(cp.id) || isLocal(cp.id))
		);
		const changedLocals = await findChangedLocals(
			checkpoints.filter((cp) => isLocal(cp.id))
		);

		const allToProcess = [...newCheckpoints, ...changedLocals];
		if (allToProcess.length === 0) {
			return { totalInserted: 0 };
		}

		await onProgress?.(
			"chunking",
			`${newCheckpoints.length} new + ${changedLocals.length} updated checkpoint(s)`
		);

		const allChunks = chunkCheckpoints(allToProcess);
		if (allChunks.length === 0) {
			return { totalInserted: 0 };
		}

		await onProgress?.("chunking", `${allChunks.length} chunk(s) to process`);

		await applySummaries(allChunks, onProgress);

		await onProgress?.(
			"embedding",
			`Embedding ${allChunks.length} chunk(s)...`
		);
		const vectors = await embedTexts(
			allChunks.map((c) => c.embeddingText),
			{
				onBatchComplete(completed, total) {
					onProgress?.("embedding", `Embedding ${completed}/${total}...`);
				},
			}
		);

		await onProgress?.("indexing", "Indexing...");
		const totalInserted = await indexChunks(allChunks, vectors, changedLocals);

		await ensureFtsIndex();
		clearCache();
		updateConfig({ lastIndexedCommit: readConfig().lastIndexedCommit });

		return { totalInserted };
	});
}
