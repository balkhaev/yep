import { runSync } from "../core/sync-engine.ts";
import { cyan, dim, green } from "../lib/cli-utils.ts";
import { createCliLogger } from "../lib/logger.ts";
import { runCodeIndex } from "./index-code.ts";

const cli = createCliLogger();

export async function syncCommand(): Promise<void> {
	cli.log("Syncing checkpoints...\n");

	const result = await runSync((step, message) => {
		cli.log(`${cyan(`[${step}]`)} ${message}`);
	});

	if (result.totalInserted === 0) {
		cli.log("Everything up to date.");
	} else {
		cli.log(`${green("[done]")} Indexed ${result.totalInserted} chunk(s)`);
	}

	cli.log(`\n${cyan("[info]")} Running code index...`);
	try {
		const codeResult = await runCodeIndex((msg) =>
			cli.log(`${dim("[code-index]")} ${msg}`)
		);
		if (!codeResult.skipped) {
			cli.log(
				`${green("[done]")} Code index: ${codeResult.totalSymbols} symbols from ${codeResult.totalFiles} files`
			);
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		cli.warning(`Code indexing failed: ${msg}`);
	}

	cli.log(`\n${green("Sync complete!")}`);
}
