import { createHash } from "node:crypto";
import type { SolutionChunk } from "../core/chunker.ts";
import { chunkCheckpoints } from "../core/chunker.ts";
import { embedTexts } from "../core/embedder.ts";
import type { ParsedCheckpoint } from "../core/parser.ts";
import { parseAllCheckpoints } from "../core/parser.ts";
import {
	ensureFtsIndex,
	getContentHash,
	getIndexedChunkIds,
	insertChunks,
	upsertChunks,
} from "../core/store.ts";
import { summarizeChunks } from "../core/summarizer.ts";
import {
	ensureProviderReady,
	readConfig,
	updateConfig,
} from "../lib/config.ts";
import { requireInit } from "../lib/guards.ts";

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

const isLocal = (id: string) => id.startsWith("local-");

async function findChangedLocals(
	localCheckpoints: ParsedCheckpoint[]
): Promise<ParsedCheckpoint[]> {
	const changed: ParsedCheckpoint[] = [];
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

async function applySummaries(chunks: SolutionChunk[]): Promise<void> {
	console.log("[info] Generating summaries...");
	const summaries = await summarizeChunks(
		chunks.map((c) => ({
			prompt: c.prompt,
			response: c.response,
			diffSummary: c.diffSummary,
		})),
		(done, total) => console.log(`  Summarizing ${done}/${total}...`)
	);

	for (let i = 0; i < chunks.length; i++) {
		const chunk = chunks[i];
		const summary = summaries[i];
		if (chunk && summary) {
			chunk.summary = summary;
			chunk.embeddingText = summary;
		}
	}
}

async function indexChunks(
	allChunks: SolutionChunk[],
	vectors: number[][],
	changedLocals: ParsedCheckpoint[]
): Promise<number> {
	const newChunks = allChunks.filter((c) => !isLocal(c.checkpointId));
	const localChunks = allChunks.filter((c) => isLocal(c.checkpointId));
	let total = 0;

	if (newChunks.length > 0) {
		const newVectors = vectors.slice(0, newChunks.length);
		total += await insertChunks(newChunks, newVectors);
	}

	if (localChunks.length > 0) {
		const localVectors = vectors.slice(newChunks.length);
		for (const cp of changedLocals) {
			const cpChunks = localChunks.filter((c) => c.checkpointId === cp.id);
			const first = cpChunks[0] ?? localChunks[0];
			const startIdx = first ? localChunks.indexOf(first) : 0;
			const cpVectors = localVectors.slice(
				startIdx,
				startIdx + cpChunks.length
			);
			const hash =
				(cp as unknown as { _contentHash: string })._contentHash ?? "";
			total += await upsertChunks(cpChunks, cpVectors, hash);
		}
	}

	return total;
}

export async function syncCommand(): Promise<void> {
	requireInit();
	ensureProviderReady();
	console.log("Syncing checkpoints...\n");

	const existingIds = await getIndexedChunkIds();
	const existingCpIds = extractCheckpointIds(existingIds);

	console.log(`[info] Found ${existingCpIds.size} already indexed checkpoints`);

	const checkpoints = await parseAllCheckpoints();
	if (checkpoints.length === 0) {
		console.log("No checkpoints found.");
		console.log("Make some commits with Entire enabled to create checkpoints.");
		return;
	}

	const newCheckpoints = checkpoints.filter(
		(cp) => !(existingCpIds.has(cp.id) || isLocal(cp.id))
	);
	const changedLocals = await findChangedLocals(
		checkpoints.filter((cp) => isLocal(cp.id))
	);

	const allToProcess = [...newCheckpoints, ...changedLocals];
	if (allToProcess.length === 0) {
		console.log("Everything up to date.");
		return;
	}

	console.log(
		`[info] ${newCheckpoints.length} new + ${changedLocals.length} updated checkpoint(s)`
	);

	const allChunks = chunkCheckpoints(allToProcess);
	if (allChunks.length === 0) {
		console.log("No chunks to index.");
		return;
	}

	console.log(`[info] ${allChunks.length} chunk(s) to process\n`);

	await applySummaries(allChunks);

	console.log("\n[info] Generating embeddings...");
	const texts = allChunks.map((c) => c.embeddingText);
	const vectors = await embedTexts(texts, {
		onBatchComplete(completed, total) {
			console.log(`  Embedding ${completed}/${total}...`);
		},
	});
	console.log(`[done] Generated ${vectors.length} embedding(s)`);

	const totalInserted = await indexChunks(allChunks, vectors, changedLocals);
	console.log(`[done] Indexed ${totalInserted} chunk(s)`);

	console.log("[info] Updating search index...");
	await ensureFtsIndex();

	const config = readConfig();
	updateConfig({ lastIndexedCommit: config.lastIndexedCommit });

	console.log("\nSync complete!");
}
