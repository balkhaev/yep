import { existsSync, watch } from "node:fs";
import { join } from "node:path";
import { cyan, dim, green } from "../lib/cli-utils.ts";
import { requireInit } from "../lib/guards.ts";
import { createCliLogger } from "../lib/logger.ts";
import { syncCommand } from "./sync.ts";

const cli = createCliLogger();

const DEBOUNCE_MS = 10_000;
const MIN_INTERVAL_MS = 30_000;

export async function watchCommand(): Promise<void> {
	requireInit();

	const metadataDir = join(process.cwd(), ".entire", "metadata");
	if (!existsSync(metadataDir)) {
		cli.error("No .entire/metadata/ directory found.");
		cli.error("Run 'entire enable' first.");
		process.exit(1);
	}

	cli.log(`${cyan("[watch]")} Monitoring ${metadataDir}`);
	cli.log(`${cyan("[watch]")} Will auto-sync when changes detected`);
	cli.log(`${cyan("[watch]")} Press Ctrl+C to stop\n`);

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let lastSync = 0;
	let syncing = false;

	const triggerSync = () => {
		if (syncing) {
			return;
		}

		const now = Date.now();
		const elapsed = now - lastSync;
		if (elapsed < MIN_INTERVAL_MS) {
			const wait = MIN_INTERVAL_MS - elapsed;
			cli.log(
				`${dim("[watch]")} Throttled, next sync in ${Math.ceil(wait / 1000)}s`
			);
			if (!debounceTimer) {
				debounceTimer = setTimeout(() => {
					debounceTimer = null;
					triggerSync();
				}, wait);
			}
			return;
		}

		syncing = true;
		lastSync = now;
		cli.log(`\n${cyan("[watch]")} Change detected, syncing...`);

		syncCommand()
			.then(() => {
				cli.log(`${green("[watch]")} Sync complete, watching...\n`);
			})
			.catch((err) => {
				const msg = err instanceof Error ? err.message : String(err);
				cli.error(`Sync failed: ${msg}\n`);
			})
			.finally(() => {
				syncing = false;
			});
	};

	const watcher = watch(metadataDir, { recursive: true }, () => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		debounceTimer = setTimeout(() => {
			debounceTimer = null;
			triggerSync();
		}, DEBOUNCE_MS);
	});

	process.on("SIGINT", () => {
		cli.log(`\n${cyan("[watch]")} Stopping...`);
		watcher.close();
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		process.exit(0);
	});

	await new Promise(() => {
		// keep alive forever until SIGINT
	});
}
