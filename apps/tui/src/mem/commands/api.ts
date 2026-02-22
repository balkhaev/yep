import { Hono } from "hono";
import { cors } from "hono/cors";
import type { SSEStreamingApi } from "hono/streaming";
import { streamSSE } from "hono/streaming";
import { z } from "zod";

// LanceDB returns BigInt for numeric fields — make them JSON-serializable
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (
	this: bigint
) {
	return Number(this);
};

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
import { embedText } from "../core/embedder.ts";
import {
	dropTable,
	getRecentSessions,
	getStats,
	initStore,
	searchByFile,
	searchSolutions,
	unifiedSearch,
} from "../core/store.ts";
import { runSync } from "../core/sync-engine.ts";
import {
	ensureProviderReady,
	isInitialized,
	type MemConfig,
	readConfig,
	updateConfig,
} from "../lib/config.ts";

type SendFn = (event: string, data: unknown) => Promise<void>;

const SearchSchema = z.object({
	query: z.string().min(1, "query is required"),
	top_k: z.number().int().positive().optional().default(5),
	min_score: z.number().min(0).max(1).optional(),
	agent: z.string().optional(),
	files: z.array(z.string()).optional(),
});

const SearchAllSchema = z.object({
	query: z.string().min(1, "query is required"),
	top_k: z.number().int().positive().optional().default(5),
	source: z.enum(["all", "transcript", "code"]).optional().default("all"),
	min_score: z.number().min(0).max(1).optional(),
});

const ConfigSchema = z
	.object({
		provider: z.enum(["openai", "ollama"]).optional(),
		openaiApiKey: z.string().nullable().optional(),
		ollamaBaseUrl: z.string().nullable().optional(),
		embeddingModel: z.string().nullable().optional(),
		summarizerModel: z.string().nullable().optional(),
		scope: z.string().optional(),
	})
	.passthrough();

const ResetSchema = z.object({
	reindex: z.boolean().optional().default(false),
});

async function runSyncSSE(send: SendFn): Promise<void> {
	const result = await runSync(async (step, message) => {
		await send("progress", { step, message });
	});

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
		message: `Sync complete! Indexed ${result.totalInserted} chunk(s).`,
		total: result.totalInserted,
	});
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
	const parsed = ConfigSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json({ error: parsed.error.flatten() }, 400);
	}
	updateConfig(parsed.data as Partial<MemConfig>);
	return c.json(readConfig());
});

app.post("/search", async (c) => {
	const parsed = SearchSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json({ error: parsed.error.flatten() }, 400);
	}

	const { query, top_k, min_score, agent, files } = parsed.data;
	ensureProviderReady();
	const queryVector = await embedText(query);
	const results = await searchSolutions(queryVector, top_k, {
		agent,
		files,
		minScore: min_score,
		queryText: query,
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
			await runSyncSSE(send);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			await send("error", { message });
		}
	});
});

app.post("/reset", async (c) => {
	const parsed = ResetSchema.safeParse(await c.req.json().catch(() => ({})));
	const reindex = parsed.success ? parsed.data.reindex : false;
	const dropped = await dropTable();
	await initStore();
	updateConfig({ lastIndexedCommit: null });

	return c.json({
		dropped,
		reinitialized: true,
		message: reindex
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
	const parsed = SearchAllSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json({ error: parsed.error.flatten() }, 400);
	}

	const { query, top_k, source, min_score } = parsed.data;
	ensureProviderReady();
	const queryVector = await embedText(query);
	const results = await unifiedSearch(queryVector, top_k, {
		source,
		minScore: min_score,
		queryText: query,
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

// ── Debug endpoints ─────────────────────────────────────────

app.post("/debug/parse", async (c) => {
	const body = (await c.req.json()) as { file: string };
	if (!body.file) {
		return c.json({ error: "file is required" }, 400);
	}
	const { debugParse } = await import("./debug.ts");
	const result = await debugParse(body.file);
	return c.json(result);
});

app.get("/debug/index", async (c) => {
	const { debugIndex } = await import("./debug.ts");
	const result = await debugIndex();
	return c.json(result);
});

app.post("/debug/search", async (c) => {
	const body = (await c.req.json()) as { query: string };
	if (!body.query) {
		return c.json({ error: "query is required" }, 400);
	}
	ensureProviderReady();
	const { debugSearch } = await import("./debug.ts");
	const result = await debugSearch(body.query);
	return c.json(result);
});

app.post("/debug/embedding", async (c) => {
	const body = (await c.req.json()) as { text: string };
	if (!body.text) {
		return c.json({ error: "text is required" }, 400);
	}
	ensureProviderReady();
	const { debugEmbedding } = await import("./debug.ts");
	const result = await debugEmbedding(body.text);
	return c.json(result);
});

app.post("/debug/symbol", async (c) => {
	const body = (await c.req.json()) as { name: string };
	if (!body.name) {
		return c.json({ error: "name is required" }, 400);
	}
	ensureProviderReady();
	const { debugSymbol } = await import("./debug.ts");
	const result = await debugSymbol(body.name);
	return c.json(result);
});

app.post("/debug/cleanup", async (c) => {
	const { debugCleanup } = await import("./debug.ts");
	const result = await debugCleanup();
	return c.json(result);
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
