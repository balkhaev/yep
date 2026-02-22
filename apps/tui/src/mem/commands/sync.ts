import { runSync } from "../core/sync-engine.ts";
import { runCodeIndex } from "./index-code.ts";

export async function syncCommand(): Promise<void> {
	console.log("Syncing checkpoints...\n");

	const result = await runSync((step, message) => {
		console.log(`[${step}] ${message}`);
	});

	if (result.totalInserted === 0) {
		console.log("Everything up to date.");
	} else {
		console.log(`[done] Indexed ${result.totalInserted} chunk(s)`);
	}

	console.log("\n[info] Running code index...");
	try {
		const codeResult = await runCodeIndex((msg) =>
			console.log(`[code-index] ${msg}`)
		);
		if (!codeResult.skipped) {
			console.log(
				`[done] Code index: ${codeResult.totalSymbols} symbols from ${codeResult.totalFiles} files`
			);
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.log(`[warn] Code indexing failed: ${msg}`);
	}

	console.log("\nSync complete!");
}
