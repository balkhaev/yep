import { existsSync } from "node:fs";
import { join } from "node:path";
import { getStats } from "../core/store.ts";
import { isInitialized, readConfig, resolveOpenAIKey } from "../lib/config.ts";
import { checkpointBranchExists } from "../lib/git.ts";

export async function statusCommand(): Promise<void> {
	console.log("\n  yep-mem status\n");

	const initialized = isInitialized();
	printRow("Initialized", initialized ? "yes" : "no");

	if (!initialized) {
		console.log("\n  Run 'yep enable' to set up yep-mem.\n");
		return;
	}

	const config = readConfig();
	printRow("Created", config.createdAt || "unknown");

	const apiKey = resolveOpenAIKey();
	printRow("OpenAI API key", apiKey ? "configured" : "MISSING");

	const entireEnabled = existsSync(join(process.cwd(), ".entire"));
	printRow("Entire enabled", entireEnabled ? "yes" : "no");

	const branchExists = await checkpointBranchExists();
	printRow("Checkpoint branch", branchExists ? "found" : "not found");

	const localMetadata = existsSync(join(process.cwd(), ".entire", "metadata"));
	printRow("Local sessions", localMetadata ? "found" : "none");

	const stats = await getStats();
	printRow("Vector table", stats.hasTable ? "exists" : "not created");
	printRow("Indexed chunks", String(stats.totalChunks));

	printRow("Last indexed commit", config.lastIndexedCommit ?? "none");

	console.log("");
}

function printRow(label: string, value: string): void {
	const isGood = ![
		"no",
		"MISSING",
		"not found",
		"none",
		"not created",
	].includes(value);
	const marker = isGood ? "\x1b[32m\u2713\x1b[0m" : "\x1b[33m\u2717\x1b[0m";
	console.log(`  ${marker} ${label.padEnd(22)} ${value}`);
}
