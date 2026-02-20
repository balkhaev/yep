import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { embedText } from "../core/embedder.ts";
import {
	getStats,
	type SolutionResult,
	searchSolutions,
} from "../core/store.ts";

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
				`Prompt: ${chunk.prompt}`,
				"",
				`Response: ${chunk.response}`,
			];

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

export function createMcpServer(): McpServer {
	const server = new McpServer({
		name: "yep-mem",
		version: "1.0.0",
	});

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
			return {
				content: [
					{
						type: "text" as const,
						text: `Vector store: ${stats.hasTable ? "active" : "not initialized"}\nTotal indexed chunks: ${stats.totalChunks}`,
					},
				],
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
