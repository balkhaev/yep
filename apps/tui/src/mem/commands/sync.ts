import { chunkCheckpoints } from "../core/chunker.ts";
import { embedTexts } from "../core/embedder.ts";
import { parseAllCheckpoints } from "../core/parser.ts";
import { getIndexedChunkIds, insertChunks } from "../core/store.ts";
import {
	ensureOpenAIKey,
	isInitialized,
	readConfig,
	updateConfig,
} from "../lib/config.ts";

export async function syncCommand(): Promise<void> {
	if (!isInitialized()) {
		console.error("Not initialized. Run 'yep enable' first.");
		process.exit(1);
	}

	ensureOpenAIKey();

	console.log("Syncing checkpoints...\n");

	const existingIds = await getIndexedChunkIds();
	const existingCheckpointIds = new Set<string>();
	for (const id of existingIds) {
		const cpId = id.split("-").slice(0, -2).join("-");
		if (cpId) {
			existingCheckpointIds.add(cpId);
		}
	}

	console.log(
		`[info] Found ${existingCheckpointIds.size} already indexed checkpoints`
	);

	const checkpoints = await parseAllCheckpoints(existingCheckpointIds);

	if (checkpoints.length === 0) {
		console.log("No new checkpoints to index.");
		console.log("Make some commits with Entire enabled to create checkpoints.");
		return;
	}

	console.log(`[info] Found ${checkpoints.length} new checkpoint(s)`);

	const chunks = chunkCheckpoints(checkpoints);
	const newChunks = chunks.filter((c) => !existingIds.has(c.id));

	if (newChunks.length === 0) {
		console.log("All chunks already indexed.");
		return;
	}

	console.log(`[info] ${newChunks.length} new chunk(s) to embed\n`);

	const texts = newChunks.map((c) => c.embeddingText);

	const vectors = await embedTexts(texts, {
		onBatchComplete(completed, total) {
			console.log(`  Embedding ${completed}/${total}...`);
		},
	});

	console.log(`\n[done] Generated ${vectors.length} embedding(s)`);

	console.log("[info] Inserting into vector store...");
	const inserted = await insertChunks(newChunks, vectors);
	console.log(`[done] Inserted ${inserted} chunk(s)`);

	const config = readConfig();
	updateConfig({ lastIndexedCommit: config.lastIndexedCommit });

	console.log("\nSync complete!");
}
