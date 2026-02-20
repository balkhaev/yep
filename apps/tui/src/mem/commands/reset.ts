import { dropTable, initStore } from "../core/store.ts";
import { isInitialized, updateConfig } from "../lib/config.ts";
import { syncCommand } from "./sync.ts";

export async function resetCommand(
	flags: { reindex?: boolean } = {}
): Promise<void> {
	if (!isInitialized()) {
		console.error("Not initialized. Run 'yep enable' first.");
		process.exit(1);
	}

	console.log("[info] Dropping vector store...");
	const dropped = await dropTable();

	if (dropped) {
		console.log("[done] Vector table dropped.");
	} else {
		console.log("[info] No vector table found, nothing to drop.");
	}

	updateConfig({ lastIndexedCommit: null });

	console.log("[info] Recreating empty vector store...");
	await initStore();
	console.log("[done] Vector store re-initialized.\n");

	if (flags.reindex) {
		console.log("Starting full re-index...\n");
		await syncCommand();
	} else {
		console.log("Run 'yep sync' to re-index from scratch.");
	}
}
