import { createHash } from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { SSEStreamingApi } from "hono/streaming";
import { streamSSE } from "hono/streaming";

// LanceDB returns BigInt for numeric fields — make them JSON-serializable
// biome-ignore lint/suspicious/noGlobalAssign: required for LanceDB BigInt compat
BigInt.prototype.toJSON = function () {
	return Number(this);
};

import { clearCache } from "../core/cache.ts";
import { chunkCheckpoints } from "../core/chunker.ts";
import {
	findCallees,
	findCallers,
	findImporters,
	findSymbolByName,
	getCodeInsights,
	getCodeStats,
	getRecentIndexedFiles,
	listAllSymbols,
} from "../core/code-store.ts";
import { embedText, embedTexts } from "../core/embedder.ts";
import type { ParsedCheckpoint } from "../core/parser.ts";
import { parseAllCheckpoints } from "../core/parser.ts";
import {
	dropTable,
	ensureFtsIndex,
	getContentHash,
	getIndexedChunkIds,
	getRecentSessions,
	getStats,
	initStore,
	insertChunks,
	searchByFile,
	searchSolutions,
	unifiedSearch,
	upsertChunks,
} from "../core/store.ts";
import { summarizeChunks } from "../core/summarizer.ts";
import {
	ensureProviderReady,
	isInitialized,
	type MemConfig,
	readConfig,
	updateConfig,
} from "../lib/config.ts";
import { requireInit } from "../lib/guards.ts";

type SendFn = (event: string, data: unknown) => Promise<void>;

const isLocal = (id: string) => id.startsWith("local-");

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

async function findChangedLocals(
	localCheckpoints: ParsedCheckpoint[]
): Promise<Array<ParsedCheckpoint & { _contentHash: string }>> {
	const changed: Array<ParsedCheckpoint & { _contentHash: string }> = [];
	for (const cp of localCheckpoints) {
		const rawContent = cp.sessions
			.map((s) => s.transcript.map((t) => t.content).join(""))
			.join("");
		const hash = createHash("sha256")
			.update(rawContent)
			.digest("hex")
			.slice(0, 16);
		const existingHash = await getContentHash(cp.id);
		if (existingHash !== hash) {
			changed.push(Object.assign(cp, { _contentHash: hash }));
		}
	}
	return changed;
}

async function runSync(send: SendFn): Promise<void> {
	ensureProviderReady();
	requireInit();

	await send("progress", {
		step: "parsing",
		message: "Parsing checkpoints...",
	});

	const existingCpIds = extractCheckpointIds(await getIndexedChunkIds());
	const checkpoints = await parseAllCheckpoints();

	if (checkpoints.length === 0) {
		await send("done", { message: "No checkpoints found.", total: 0 });
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
		await send("done", { message: "Everything up to date.", total: 0 });
		return;
	}

	await send("progress", {
		step: "chunking",
		message: `${newCheckpoints.length} new + ${changedLocals.length} updated checkpoint(s)`,
	});

	const allChunks = chunkCheckpoints(allToProcess);
	if (allChunks.length === 0) {
		await send("done", { message: "No chunks to index.", total: 0 });
		return;
	}

	await send("progress", {
		step: "summarizing",
		message: `Summarizing ${allChunks.length} chunk(s)...`,
	});
	const summaries = await summarizeChunks(
		allChunks.map((c) => ({
			prompt: c.prompt,
			response: c.response,
			diffSummary: c.diffSummary,
		})),
		(done, total) => {
			send("progress", {
				step: "summarizing",
				message: `Summarizing ${done}/${total}...`,
			});
		}
	);
	for (let i = 0; i < allChunks.length; i++) {
		const chunk = allChunks[i];
		const summary = summaries[i];
		if (chunk && summary) {
			chunk.summary = summary;
			chunk.embeddingText = summary;
		}
	}

	await send("progress", {
		step: "embedding",
		message: `Embedding ${allChunks.length} chunk(s)...`,
	});
	const vectors = await embedTexts(
		allChunks.map((c) => c.embeddingText),
		{
			onBatchComplete(completed, total) {
				send("progress", {
					step: "embedding",
					message: `Embedding ${completed}/${total}...`,
				});
			},
		}
	);

	await send("progress", { step: "indexing", message: "Indexing..." });
	const totalInserted = await indexSyncResults(
		allChunks,
		vectors,
		changedLocals
	);

	await ensureFtsIndex();
	clearCache();
	updateConfig({ lastIndexedCommit: readConfig().lastIndexedCommit });

	await send("progress", {
		step: "code-index",
		message: "Indexing code symbols...",
	});

	try {
		const { runCodeIndex } = await import("./index-code.ts");
		const codeResult = await runCodeIndex((msg, progress) => {
			send("progress", { step: "code-index", message: msg, ...progress });
		});

		if (codeResult.skipped) {
			await send("progress", {
				step: "code-index",
				message: "Code index up to date.",
			});
		} else {
			await send("progress", {
				step: "code-index",
				message: `Code: ${codeResult.totalSymbols} symbols from ${codeResult.totalFiles} files`,
			});
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		await send("progress", {
			step: "code-index",
			message: `Code index warning: ${msg}`,
		});
	}

	await send("done", {
		message: `Sync complete! Indexed ${totalInserted} chunk(s).`,
		total: totalInserted,
	});
}

async function indexSyncResults(
	allChunks: ReturnType<typeof chunkCheckpoints>,
	vectors: number[][],
	changedLocals: Array<ParsedCheckpoint & { _contentHash: string }>
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
			const first = cpChunks[0] ?? localChunks[0];
			const startIdx = first ? localChunks.indexOf(first) : 0;
			const cpVectors = localVectors.slice(
				startIdx,
				startIdx + cpChunks.length
			);
			total += await upsertChunks(cpChunks, cpVectors, cp._contentHash);
		}
	}

	return total;
}

const app = new Hono();

app.use("/*", cors({ origin: "*" }));

app.get("/health", (c) => c.json({ ok: true }));

app.get("/status", async (c) => {
	const initialized = isInitialized();
	if (!initialized) {
		return c.json({ initialized, stats: null, config: null });
	}
	const [stats, config] = await Promise.all([getStats(), readConfig()]);
	return c.json({ initialized, stats, config });
});

app.get("/config", (c) => c.json(readConfig()));

app.post("/config", async (c) => {
	const body = (await c.req.json()) as Partial<MemConfig>;
	updateConfig(body);
	return c.json(readConfig());
});

app.post("/search", async (c) => {
	const body = (await c.req.json()) as {
		query: string;
		top_k?: number;
		min_score?: number;
		agent?: string;
		files?: string[];
	};

	if (!body.query) {
		return c.json({ error: "query is required" }, 400);
	}

	ensureProviderReady();
	const queryVector = await embedText(body.query);
	const results = await searchSolutions(queryVector, body.top_k ?? 5, {
		agent: body.agent,
		files: body.files,
		minScore: body.min_score,
		queryText: body.query,
	});

	return c.json({ results });
});

app.get("/diff", async (c) => {
	const file = c.req.query("file");
	if (!file) {
		return c.json({ error: "file query param is required" }, 400);
	}

	const results = await searchByFile(file);
	const sorted = results.sort((a, b) => {
		if (!(a.timestamp && b.timestamp)) {
			return 0;
		}
		return a.timestamp.localeCompare(b.timestamp);
	});

	return c.json({ file, results: sorted });
});

app.post("/sync", (c) => {
	return streamSSE(c, async (stream: SSEStreamingApi) => {
		const send: SendFn = (event, data) =>
			stream.writeSSE({ data: JSON.stringify(data), event });

		try {
			await runSync(send);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			await send("error", { message });
		}
	});
});

app.post("/reset", async (c) => {
	const body = (await c.req.json().catch(() => ({}))) as { reindex?: boolean };
	const dropped = await dropTable();
	await initStore();
	updateConfig({ lastIndexedCommit: null });

	return c.json({
		dropped,
		reinitialized: true,
		message: body.reindex
			? "Store reset. Use POST /sync to reindex."
			: "Store reset.",
	});
});

app.get("/code/stats", async (c) => {
	const stats = await getCodeStats();
	return c.json(stats);
});

app.get("/code/symbols", async (c) => {
	const type = c.req.query("type");
	const limit = Number(c.req.query("limit")) || 500;
	const all = await listAllSymbols(limit);
	const filtered = type ? all.filter((s) => s.symbolType === type) : all;
	return c.json({ symbols: filtered });
});

app.get("/code/files", async (c) => {
	const limit = Number(c.req.query("limit")) || 20;
	const files = await getRecentIndexedFiles(limit);
	return c.json({ files });
});

app.get("/code/symbol/:name", async (c) => {
	const name = c.req.param("name");
	const definition = await findSymbolByName(name);
	if (!definition) {
		return c.json({ error: "Symbol not found" }, 404);
	}

	const [callers, callees, importers] = await Promise.all([
		findCallers(name),
		findCallees(name),
		findImporters(name),
	]);

	return c.json({ definition, callers, callees, importers });
});

app.post("/search-all", async (c) => {
	const body = (await c.req.json()) as {
		query: string;
		top_k?: number;
		source?: "all" | "transcript" | "code";
		min_score?: number;
	};

	if (!body.query) {
		return c.json({ error: "query is required" }, 400);
	}

	ensureProviderReady();
	const queryVector = await embedText(body.query);
	const results = await unifiedSearch(queryVector, body.top_k ?? 5, {
		source: body.source ?? "all",
		minScore: body.min_score,
		queryText: body.query,
	});

	return c.json({ results });
});

app.get("/recent", async (c) => {
	const limit = Number(c.req.query("limit")) || 10;
	const sessions = await getRecentSessions(limit);
	return c.json({ sessions });
});

app.get("/code/insights", async (c) => {
	const insights = await getCodeInsights();
	if (!insights) {
		return c.json({ error: "Code index not available. Run sync first." }, 404);
	}
	return c.json(insights);
});

app.post("/index-code", (c) => {
	return streamSSE(c, async (stream) => {
		const send = async (event: string, data: unknown): Promise<void> => {
			await stream.writeSSE({ event, data: JSON.stringify(data) });
		};

		try {
			ensureProviderReady();
			const { runCodeIndex } = await import("./index-code.ts");

			await send("progress", {
				step: "indexing",
				message: "Starting code index...",
			});

			const result = await runCodeIndex((msg, progress) => {
				send("progress", { step: "indexing", message: msg, ...progress });
			});

			if (result.skipped) {
				await send("done", { message: "No changed files to index.", total: 0 });
			} else {
				await send("done", {
					message: `Indexed ${result.totalSymbols} symbols from ${result.totalFiles} files`,
					totalSymbols: result.totalSymbols,
					totalFiles: result.totalFiles,
				});
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			await send("error", { message: msg });
		}
	});
});

export { app as apiApp };

export function apiCommand(port = 3838): void {
	if (!isInitialized()) {
		console.error("Not initialized. Run 'yep enable' first.");
		process.exit(1);
	}

	console.log(`Starting yep-mem API server on http://localhost:${port}`);
	Bun.serve({ fetch: app.fetch, port });
	console.log(`API server running at http://localhost:${port}`);
}
