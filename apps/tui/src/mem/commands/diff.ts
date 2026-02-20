import { searchByFile } from "../core/store.ts";
import { requireInit } from "../lib/guards.ts";

function clean(raw: string, maxLen = 100): string {
	return raw
		.replace(/<[^>]+>/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, maxLen);
}

export async function diffCommand(file: string | undefined): Promise<void> {
	if (!file) {
		console.error("Usage: yep diff <file-path>");
		process.exit(1);
	}

	requireInit();

	const results = await searchByFile(file);

	if (results.length === 0) {
		console.log(`No memory entries found for "${file}".`);
		console.log("Run 'yep sync' to index checkpoints first.");
		return;
	}

	console.log(`\n  Memory timeline for ${file}\n`);

	const sorted = results.sort((a, b) => {
		if (!(a.timestamp && b.timestamp)) {
			return 0;
		}
		return a.timestamp.localeCompare(b.timestamp);
	});

	for (const [i, result] of sorted.entries()) {
		const time = result.timestamp
			? new Date(result.timestamp).toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
					hour: "2-digit",
					minute: "2-digit",
				})
			: "unknown";

		const agent = result.agent !== "unknown" ? ` (${result.agent})` : "";
		const summary = clean(result.summary || result.prompt);

		console.log(
			`  \x1b[2m${String(i + 1).padStart(2)}.\x1b[0m \x1b[36m${time}\x1b[0m${agent}`
		);
		console.log(`      ${summary}`);

		if (result.diffSummary) {
			console.log(`      \x1b[2m${clean(result.diffSummary)}\x1b[0m`);
		}

		console.log("");
	}

	console.log(`  ${sorted.length} session(s) touched this file.\n`);
}
