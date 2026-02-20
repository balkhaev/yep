import { embedText } from "../core/embedder.ts";
import { type SolutionResult, searchSolutions } from "../core/store.ts";
import { ensureOpenAIKey, isInitialized } from "../lib/config.ts";

function formatForContext(
	results: Array<{ chunk: SolutionResult; score: number }>
): string {
	if (results.length === 0) {
		return "";
	}

	const sections = results.map((r, i) => {
		const { chunk, score } = r;
		const lines = [
			`## Past Solution ${i + 1} (relevance: ${score.toFixed(2)})`,
			"",
		];

		if (chunk.summary) {
			lines.push(`**Summary:** ${chunk.summary}`, "");
		}

		lines.push(`**Prompt:** ${chunk.prompt.slice(0, 300)}`);

		if (chunk.response) {
			lines.push("", `**Response:** ${chunk.response.slice(0, 800)}`);
		}

		if (chunk.filesChanged) {
			lines.push("", `**Files:** ${chunk.filesChanged}`);
		}

		if (chunk.diffSummary) {
			lines.push("", `**Changes:** ${chunk.diffSummary.slice(0, 400)}`);
		}

		return lines.join("\n");
	});

	return [
		"# Relevant Past Solutions",
		"",
		"The following solutions from past AI coding sessions are relevant to your current task:",
		"",
		sections.join("\n\n---\n\n"),
	].join("\n");
}

export async function contextCommand(query: string | undefined): Promise<void> {
	if (!query) {
		console.error('Usage: yep context "<task description>"');
		process.exit(1);
	}

	if (!isInitialized()) {
		process.exit(0);
	}

	const key = ensureOpenAIKey();
	if (!key) {
		process.exit(0);
	}

	const queryVector = await embedText(query);
	const results = await searchSolutions(queryVector, 5, { queryText: query });

	const output = formatForContext(results);
	if (output) {
		console.log(output);
	}
}
