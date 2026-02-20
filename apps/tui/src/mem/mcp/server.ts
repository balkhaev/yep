import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { embedText } from "../core/embedder.ts";
import {
	getStats,
	type SolutionResult,
	searchSolutions,
} from "../core/store.ts";
import { readConfig } from "../lib/config.ts";

function formatSearchResults(
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

async function buildMemorySummary(): Promise<string> {
	const config = readConfig();
	const stats = await getStats();

	const lines = [
		"# Project Memory Summary",
		"",
		`- **Status:** ${stats.hasTable ? "active" : "not initialized"}`,
		`- **Indexed chunks:** ${stats.totalChunks}`,
		`- **Created:** ${config.createdAt || "unknown"}`,
		`- **Embedding model:** ${config.embeddingModel ?? "text-embedding-3-small"}`,
	];

	if (stats.agents.length > 0) {
		lines.push(`- **Agents:** ${stats.agents.join(", ")}`);
	}

	if (stats.topFiles.length > 0) {
		lines.push("", "## Most Touched Files", "");
		for (const f of stats.topFiles) {
			lines.push(`- ${f}`);
		}
	}

	lines.push(
		"",
		"Use the `search_solutions` tool to find relevant past sessions."
	);

	return lines.join("\n");
}

export function createMcpServer(): McpServer {
	const server = new McpServer({
		name: "yep-mem",
		version: "2.0.0",
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

	server.tool(
		"search_solutions",
		"Search past AI coding sessions for relevant solutions. Use before starting a task to get context from similar past work.",
		{
			query: z.string().describe("What you're trying to solve or implement"),
			top_k: z
				.number()
				.min(1)
				.max(20)
				.default(5)
				.describe("Number of results to return"),
			agent: z
				.string()
				.optional()
				.describe("Filter by agent type (e.g. claude-code, gemini)"),
			files: z
				.array(z.string())
				.optional()
				.describe("Filter by files involved (partial match on file paths)"),
		},
		async ({ query, top_k, agent, files }) => {
			const queryVector = await embedText(query);
			const results = await searchSolutions(queryVector, top_k, {
				agent,
				files,
				queryText: query,
			});

			return {
				content: [
					{
						type: "text" as const,
						text: formatSearchResults(results),
					},
				],
			};
		}
	);

	server.tool(
		"mem_stats",
		"Get statistics about the yep-mem vector store",
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
					`Most touched files: ${stats.topFiles.slice(0, 5).join(", ")}`
				);
			}
			return {
				content: [{ type: "text" as const, text: lines.join("\n") }],
			};
		}
	);

	return server;
}

export async function startMcpServer(): Promise<void> {
	const server = createMcpServer();
	const transport = new StdioServerTransport();
	await server.connect(transport);
}
