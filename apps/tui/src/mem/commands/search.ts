import { embedText } from "../core/embedder.ts";
import { type SolutionResult, searchSolutions } from "../core/store.ts";
import { ensureOpenAIKey, isInitialized } from "../lib/config.ts";

function formatResult(
	index: number,
	result: { chunk: SolutionResult; score: number }
): string {
	const { chunk, score } = result;
	const lines = [
		`--- Solution ${index + 1} (score: ${score.toFixed(2)}) ---`,
		`Agent: ${chunk.agent}`,
		chunk.timestamp ? `Time: ${chunk.timestamp}` : "",
		`Prompt: ${chunk.prompt.slice(0, 200)}`,
		"",
		`Response: ${chunk.response.slice(0, 500)}`,
	];

	if (chunk.diffSummary) {
		lines.push("", `Changes: ${chunk.diffSummary.slice(0, 300)}`);
	}

	if (chunk.filesChanged) {
		lines.push(`Files: ${chunk.filesChanged}`);
	}

	lines.push("");
	return lines.filter((l) => l !== undefined).join("\n");
}

export async function searchCommand(query: string | undefined): Promise<void> {
	if (!query) {
		console.error('Usage: yep search "<query>"');
		process.exit(1);
	}

	if (!isInitialized()) {
		console.error("Not initialized. Run 'yep enable' first.");
		process.exit(1);
	}

	ensureOpenAIKey();

	console.log(`Searching for: "${query}"\n`);

	const queryVector = await embedText(query);
	const results = await searchSolutions(queryVector, 5, { queryText: query });

	if (results.length === 0) {
		console.log("No results found. Run 'yep sync' to index checkpoints.");
		return;
	}

	console.log(`Found ${results.length} result(s):\n`);

	for (const [i, result] of results.entries()) {
		console.log(formatResult(i, result));
	}
}
