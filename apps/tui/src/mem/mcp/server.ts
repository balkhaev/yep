import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
	type CodeResult,
	findCallees,
	findCallers,
	findImporters,
	findSymbolByName,
	findSymbolsByPath,
	getCodeStats,
	getRecentIndexedFiles,
	listAllSymbols,
} from "../core/code-store.ts";
import { embedText } from "../core/embedder.ts";
import {
	getRecentSessions,
	getStats,
	type SearchSource,
	type SolutionResult,
	searchSolutions,
	type UnifiedResult,
	unifiedSearch,
} from "../core/store.ts";
import { readConfig } from "../lib/config.ts";

function formatCompactResults(
	results: Array<{ chunk: SolutionResult; score: number }>
): string {
	if (results.length === 0) {
		return "No relevant past solutions found. The vector store may be empty — run `yep sync` to index checkpoints.";
	}

	return results
		.map((r, i) => {
			const { chunk, score } = r;
			const lines = [
				`--- Past Solution ${i + 1} (relevance: ${score.toFixed(2)}) ---`,
			];

			if (chunk.summary) {
				lines.push(`Summary: ${chunk.summary}`);
			} else {
				lines.push(`Prompt: ${chunk.prompt.slice(0, 200)}`);
			}

			if (chunk.filesChanged) {
				lines.push(`Files: ${chunk.filesChanged}`);
			}

			lines.push("---");
			return lines.join("\n");
		})
		.join("\n\n");
}

function formatFullResults(
	results: Array<{ chunk: SolutionResult; score: number }>
): string {
	if (results.length === 0) {
		return "No relevant past solutions found. The vector store may be empty — run `yep sync` to index checkpoints.";
	}

	return results
		.map((r, i) => {
			const { chunk, score } = r;
			const lines: (string | null)[] = [
				`--- Past Solution ${i + 1} (relevance: ${score.toFixed(2)}) ---`,
				`Checkpoint: ${chunk.checkpointId}`,
				`Agent: ${chunk.agent}`,
				chunk.timestamp ? `Time: ${chunk.timestamp}` : null,
			];

			if (chunk.summary) {
				lines.push("", `Summary: ${chunk.summary}`);
			}

			lines.push(
				"",
				`Prompt: ${chunk.prompt}`,
				"",
				`Response: ${chunk.response}`
			);

			if (chunk.diffSummary) {
				lines.push("", `Code changes: ${chunk.diffSummary}`);
			}

			if (chunk.filesChanged) {
				lines.push(`Files: ${chunk.filesChanged}`);
			}

			lines.push("---");
			return lines.filter((l): l is string => l !== null).join("\n");
		})
		.join("\n\n");
}

function formatUnifiedResults(results: UnifiedResult[]): string {
	if (results.length === 0) {
		return "No relevant results found. Run `yep sync` and/or `yep index-code` to populate the store.";
	}

	return results
		.map((r, i) => {
			const lines = [
				`--- Result ${i + 1} [${r.source}] (score: ${r.score.toFixed(3)}) ---`,
			];

			if (r.source === "code") {
				lines.push(`Symbol: ${r.symbolType} ${r.symbol}`);
				lines.push(`Path: ${r.path}`);
				if (r.body) {
					lines.push(`\n${r.body.slice(0, 500)}`);
				}
			} else {
				lines.push(`Summary: ${r.summary}`);
				if (r.filesChanged) {
					lines.push(`Files: ${r.filesChanged}`);
				}
				if (r.timestamp) {
					lines.push(`Time: ${r.timestamp}`);
				}
			}

			lines.push("---");
			return lines.join("\n");
		})
		.join("\n\n");
}

async function buildMemorySummary(): Promise<string> {
	const config = readConfig();
	const stats = await getStats();

	const lines = [
		"# Project Memory Summary",
		"",
		`- **Status:** ${stats.hasTable ? "active" : "not initialized"}`,
		`- **Provider:** ${config.provider}`,
		`- **Indexed chunks:** ${stats.totalChunks}`,
		`- **Created:** ${config.createdAt || "unknown"}`,
		`- **Embedding model:** ${config.embeddingModel ?? "auto"}`,
	];

	if (stats.agents.length > 0) {
		lines.push(`- **Agents:** ${stats.agents.join(", ")}`);
	}

	if (stats.topFiles.length > 0) {
		lines.push("", "## Most Touched Files", "");
		for (const { file, count } of stats.topFiles.slice(0, 5)) {
			lines.push(`- ${file} (${count} refs)`);
		}
	}

	try {
		const codeStats = await getCodeStats();
		if (codeStats.hasTable) {
			lines.push(
				"",
				"## Code Index",
				`- **Indexed symbols:** ${codeStats.totalSymbols}`,
				`- **Languages:** ${codeStats.languages.join(", ") || "none"}`
			);
		}
	} catch {
		// code table may not exist
	}

	lines.push(
		"",
		"Use `search_solutions` for past sessions, `search_all` for unified code + session search."
	);

	return lines.join("\n");
}

async function execGit(args: string): Promise<{ ok: boolean; output: string }> {
	const proc = Bun.spawn(["sh", "-c", `git ${args}`], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const output = await new Response(proc.stdout).text();
	const exitCode = await proc.exited;
	return { ok: exitCode === 0, output: output.trim() };
}

async function collectAffectedSymbols(
	changedFiles: string[]
): Promise<CodeResult[]> {
	const results: CodeResult[] = [];
	for (const filePath of changedFiles) {
		const sym = await findSymbolsByPath(filePath);
		results.push(...sym);
	}
	return results;
}

async function collectIndirectCallers(
	affected: CodeResult[]
): Promise<CodeResult[]> {
	const callerSet = new Map<string, CodeResult>();
	const affectedIds = new Set(affected.map((a) => a.id));

	for (const s of affected.slice(0, 15)) {
		const callers = await findCallers(s.symbol);
		for (const c of callers) {
			if (!(callerSet.has(c.id) || affectedIds.has(c.id))) {
				callerSet.set(c.id, c);
			}
		}
	}
	return [...callerSet.values()];
}

async function findRelatedSessions(
	changedFiles: string[],
	topK: number
): Promise<Array<{ chunk: SolutionResult; score: number }>> {
	if (topK <= 0 || changedFiles.length === 0) {
		return [];
	}
	const query = `changes to ${changedFiles.slice(0, 5).join(", ")}`;
	const queryVector = await embedText(query);
	return searchSolutions(queryVector, topK, {
		queryText: query,
		files: changedFiles.slice(0, 5),
		minScore: 0.15,
	});
}

function blastRadiusSummary(direct: number, indirect: number): string {
	const total = direct + indirect;
	if (total > 20) {
		return "⚠️ Large blast radius — consider testing thoroughly";
	}
	if (total > 5) {
		return "Moderate blast radius — verify callers still work";
	}
	return "Small blast radius — changes appear well-contained";
}

function formatSessionList(
	sessions: Array<{ chunk: SolutionResult; score: number }>
): string[] {
	if (sessions.length === 0) {
		return [];
	}
	const lines = ["", "## Related Past Sessions"];
	for (const s of sessions) {
		const summary = s.chunk.summary || s.chunk.prompt.slice(0, 150);
		const files = s.chunk.filesChanged
			? ` (files: ${s.chunk.filesChanged})`
			: "";
		lines.push(`- [score: ${s.score.toFixed(2)}] ${summary}${files}`);
	}
	return lines;
}

async function buildDetectChangesReport(
	ref: string,
	topKSessions: number
): Promise<string> {
	const diffResult = await execGit(`diff ${ref} --name-only`);
	if (!(diffResult.ok && diffResult.output)) {
		return "No changes detected (clean working tree).";
	}

	const changedFiles = diffResult.output.split("\n").filter(Boolean);
	const lines: string[] = [
		"# Change Impact Analysis",
		"",
		`## Changed Files (${changedFiles.length})`,
		...changedFiles.map((f) => `- ${f}`),
	];

	const affected = await collectAffectedSymbols(changedFiles);
	if (affected.length > 0) {
		lines.push("", `## Directly Affected Symbols (${affected.length})`);
		for (const s of affected.slice(0, 30)) {
			const deps = s.calls
				? ` → calls: ${s.calls.split(",").slice(0, 5).join(", ")}`
				: "";
			lines.push(`- ${s.symbolType} **${s.symbol}** (${s.path})${deps}`);
		}
	}

	const indirect = await collectIndirectCallers(affected);
	lines.push(
		...formatSymbolList(
			`Blast Radius — Indirect Callers (${indirect.length})`,
			indirect.slice(0, 20)
		)
	);

	const sessions = await findRelatedSessions(changedFiles, topKSessions);
	lines.push(...formatSessionList(sessions));

	lines.push(
		"",
		"## Summary",
		`- **${changedFiles.length}** files changed, **${affected.length}** symbols directly affected, **${indirect.length}** indirect callers`,
		`- ${blastRadiusSummary(affected.length, indirect.length)}`
	);

	return lines.join("\n");
}

function formatSymbolList(heading: string, items: CodeResult[]): string[] {
	if (items.length === 0) {
		return [];
	}
	const lines = ["", `## ${heading}`];
	for (const c of items) {
		lines.push(`- ${c.symbolType} **${c.symbol}** (${c.path})`);
	}
	return lines;
}

async function buildSymbolContext(
	symbol: string,
	includeSessions: boolean,
	topKSessions: number
): Promise<string> {
	const definition = await findSymbolByName(symbol);
	if (!definition) {
		return `Symbol "${symbol}" not found in the code index. Run \`yep index-code\` to index your codebase.`;
	}

	const lines: string[] = [`# Symbol Context: ${symbol}`, ""];
	lines.push("## Definition");
	lines.push(`- **Type:** ${definition.symbolType}`);
	lines.push(`- **Path:** ${definition.path}`);
	lines.push(`- **Language:** ${definition.language}`);
	if (definition.calls) {
		lines.push(`- **Calls:** ${definition.calls.split(",").join(", ")}`);
	}
	if (definition.imports) {
		lines.push(`- **Imports:** ${definition.imports.split(",").join(", ")}`);
	}
	lines.push("", "```", definition.body.slice(0, 1500), "```");

	const [callers, callees, importers] = await Promise.all([
		findCallers(symbol),
		findCallees(symbol),
		findImporters(symbol),
	]);

	lines.push(...formatSymbolList("Called by", callers));
	lines.push(...formatSymbolList("Calls", callees));
	lines.push(...formatSymbolList("Imported by", importers));

	if (includeSessions) {
		const queryVector = await embedText(symbol);
		const sessions = await searchSolutions(queryVector, topKSessions, {
			queryText: symbol,
			minScore: 0.2,
		});
		if (sessions.length > 0) {
			lines.push("", "## Related Past Sessions");
			for (const s of sessions) {
				const summary = s.chunk.summary || s.chunk.prompt.slice(0, 150);
				const files = s.chunk.filesChanged
					? ` (files: ${s.chunk.filesChanged})`
					: "";
				lines.push(`- [score: ${s.score.toFixed(2)}] ${summary}${files}`);
			}
		}
	}

	return lines.join("\n");
}

export function createMcpServer(): McpServer {
	const server = new McpServer({
		name: "yep-mem",
		version: "4.0.0",
	});

	server.resource("memory-summary", "memory://summary", async () => ({
		contents: [
			{
				uri: "memory://summary",
				mimeType: "text/markdown",
				text: await buildMemorySummary(),
			},
		],
	}));

	server.resource("memory-symbols", "memory://symbols", async () => {
		const symbols = await listAllSymbols(500);
		const lines = ["# Indexed Code Symbols", ""];
		if (symbols.length === 0) {
			lines.push(
				"No symbols indexed yet. Run `yep index-code` to index your codebase."
			);
		} else {
			const byType = new Map<string, typeof symbols>();
			for (const s of symbols) {
				const arr = byType.get(s.symbolType) ?? [];
				arr.push(s);
				byType.set(s.symbolType, arr);
			}
			for (const [type, items] of byType) {
				lines.push(`## ${type}s (${items.length})`);
				for (const s of items) {
					lines.push(`- **${s.symbol}** — ${s.path}`);
				}
				lines.push("");
			}
		}
		return {
			contents: [
				{
					uri: "memory://symbols",
					mimeType: "text/markdown",
					text: lines.join("\n"),
				},
			],
		};
	});

	server.resource("memory-files", "memory://files", async () => {
		const files = await getRecentIndexedFiles(30);
		const lines = ["# Indexed Files", ""];
		if (files.length === 0) {
			lines.push("No files indexed yet. Run `yep index-code`.");
		} else {
			lines.push("| File | Symbols | Last Modified |");
			lines.push("|------|---------|---------------|");
			for (const f of files) {
				lines.push(`| ${f.path} | ${f.symbolCount} | ${f.lastModified} |`);
			}
		}
		return {
			contents: [
				{
					uri: "memory://files",
					mimeType: "text/markdown",
					text: lines.join("\n"),
				},
			],
		};
	});

	server.resource("memory-recent", "memory://recent", async () => {
		const recent = await getRecentSessions(10);
		const lines = ["# Recent Session Activity", ""];
		if (recent.length === 0) {
			lines.push(
				"No sessions indexed yet. Run `yep sync` after some AI coding sessions."
			);
		} else {
			for (const s of recent) {
				const desc = s.summary || "(no summary)";
				const files = s.filesChanged
					? ` — files: ${s.filesChanged.split(",").slice(0, 3).join(", ")}`
					: "";
				lines.push(`- **${s.timestamp}** [${s.agent}] ${desc}${files}`);
			}
		}
		return {
			contents: [
				{
					uri: "memory://recent",
					mimeType: "text/markdown",
					text: lines.join("\n"),
				},
			],
		};
	});

	server.tool(
		"search_solutions",
		"Search past AI coding sessions for relevant solutions. Use before starting a task to get context from similar past work. Returns compact summaries by default to save context tokens.",
		{
			query: z.string().describe("What you're trying to solve or implement"),
			top_k: z
				.number()
				.min(1)
				.max(20)
				.default(3)
				.describe("Number of results to return"),
			compact: z
				.boolean()
				.default(true)
				.describe(
					"Return compact summaries (true) or full prompt/response (false)"
				),
			min_score: z
				.number()
				.min(0)
				.max(1)
				.default(0.3)
				.describe("Minimum relevance score threshold (0-1)"),
			agent: z
				.string()
				.optional()
				.describe("Filter by agent type (e.g. claude-code, gemini)"),
			files: z
				.array(z.string())
				.optional()
				.describe("Filter by files involved (partial match on file paths)"),
		},
		async ({ query, top_k, compact, min_score, agent, files }) => {
			const queryVector = await embedText(query);
			const results = await searchSolutions(queryVector, top_k, {
				agent,
				files,
				queryText: query,
				minScore: min_score,
			});

			const format = compact ? formatCompactResults : formatFullResults;
			return {
				content: [
					{
						type: "text" as const,
						text: format(results),
					},
				],
			};
		}
	);

	server.tool(
		"search_all",
		"Unified search across past AI sessions AND indexed code symbols. Best for broad queries like 'how does auth work?' or 'find AuthMiddleware and related code'.",
		{
			query: z.string().describe("What you're looking for"),
			top_k: z.number().min(1).max(30).default(5).describe("Number of results"),
			source: z
				.enum(["all", "transcript", "code"])
				.default("all")
				.describe(
					"Filter by source: 'all' (default), 'transcript' (past sessions), 'code' (indexed symbols)"
				),
			min_score: z
				.number()
				.min(0)
				.max(1)
				.default(0.1)
				.describe("Minimum relevance score"),
		},
		async ({ query, top_k, source, min_score }) => {
			const queryVector = await embedText(query);
			const results = await unifiedSearch(queryVector, top_k, {
				queryText: query,
				minScore: min_score,
				source: source as SearchSource,
			});

			return {
				content: [
					{
						type: "text" as const,
						text: formatUnifiedResults(results),
					},
				],
			};
		}
	);

	server.tool(
		"symbol_context",
		"Get a 360-degree view of a code symbol: definition, callers, callees, importers, and related past sessions. Use to understand impact before editing a function or class.",
		{
			symbol: z
				.string()
				.describe("Name of the function, class, or type to look up"),
			include_sessions: z
				.boolean()
				.default(true)
				.describe("Also search past sessions mentioning this symbol"),
			top_k_sessions: z
				.number()
				.min(1)
				.max(10)
				.default(3)
				.describe("Max past sessions to include"),
		},
		async ({ symbol, include_sessions, top_k_sessions }) => ({
			content: [
				{
					type: "text" as const,
					text: await buildSymbolContext(
						symbol,
						include_sessions,
						top_k_sessions
					),
				},
			],
		})
	);

	server.tool(
		"detect_changes",
		"Analyze current git diff to find affected symbols, their blast radius (callers/dependents), and related past sessions. Use before committing to understand impact.",
		{
			ref: z
				.string()
				.default("HEAD")
				.describe(
					"Git ref to diff against (default: HEAD for uncommitted changes)"
				),
			top_k_sessions: z
				.number()
				.min(0)
				.max(10)
				.default(3)
				.describe("Number of related past sessions to find (0 to skip)"),
		},
		async ({ ref, top_k_sessions }) => ({
			content: [
				{
					type: "text" as const,
					text: await buildDetectChangesReport(ref, top_k_sessions),
				},
			],
		})
	);

	server.tool(
		"mem_stats",
		"Get statistics about the yep-mem vector store and code index",
		{},
		async () => {
			const stats = await getStats();
			const lines = [
				`Vector store: ${stats.hasTable ? "active" : "not initialized"}`,
				`Total indexed chunks: ${stats.totalChunks}`,
			];
			if (stats.agents.length > 0) {
				lines.push(`Agents: ${stats.agents.join(", ")}`);
			}
			if (stats.topFiles.length > 0) {
				lines.push(
					`Most touched files: ${stats.topFiles
						.slice(0, 5)
						.map(({ file, count }) => `${file} (${count})`)
						.join(", ")}`
				);
			}

			try {
				const codeStats = await getCodeStats();
				if (codeStats.hasTable) {
					lines.push(
						`Code symbols indexed: ${codeStats.totalSymbols}`,
						`Languages: ${codeStats.languages.join(", ")}`
					);
				}
			} catch {
				// code table may not exist
			}

			return {
				content: [{ type: "text" as const, text: lines.join("\n") }],
			};
		}
	);

	server.prompt(
		"pre_task",
		"Before starting a new coding task, search memory for relevant past sessions and code context.",
		{
			task: z
				.string()
				.describe("Brief description of the task you are about to start"),
		},
		async ({ task }) => ({
			messages: [
				{
					role: "user" as const,
					content: {
						type: "text" as const,
						text: [
							`I'm about to work on: "${task}"`,
							"",
							"Before I start, please:",
							"1. Call `search_solutions` with this task description to find relevant past sessions",
							"2. Call `search_all` to find related code symbols and past work",
							"3. If specific functions/classes are mentioned, call `symbol_context` for each",
							"4. Summarize what you found: relevant patterns, past decisions, potential pitfalls",
							"5. Suggest an approach based on what worked (or failed) before",
						].join("\n"),
					},
				},
			],
		})
	);

	server.prompt(
		"pre_commit",
		"Before committing changes, check blast radius and past session warnings.",
		async () => ({
			messages: [
				{
					role: "user" as const,
					content: {
						type: "text" as const,
						text: [
							"I'm about to commit my changes. Before I do, please:",
							"",
							"1. Call `detect_changes` to see which symbols are affected by the current git diff",
							"2. For each affected symbol, briefly check `symbol_context` to understand callers/dependents",
							"3. Search `search_solutions` for past sessions that touched the same files",
							"4. Report:",
							"   - Blast radius summary (what could break)",
							"   - Any warnings from past sessions (e.g., 'last time this was changed, tests broke')",
							"   - Confidence level that the changes are safe",
						].join("\n"),
					},
				},
			],
		})
	);

	return server;
}

export async function startMcpServer(): Promise<void> {
	const server = createMcpServer();
	const transport = new StdioServerTransport();
	await server.connect(transport);
}
