import { existsSync, watch } from "node:fs";
import { join } from "node:path";
import { isInitialized } from "../lib/config.ts";
import { syncCommand } from "./sync.ts";

const DEBOUNCE_MS = 10_000;
const MIN_INTERVAL_MS = 30_000;

export async function watchCommand(): Promise<void> {
	if (!isInitialized()) {
		console.error("Not initialized. Run 'yep enable' first.");
		process.exit(1);
	}

	const metadataDir = join(process.cwd(), ".entire", "metadata");
	if (!existsSync(metadataDir)) {
		console.error("No .entire/metadata/ directory found.");
		console.error("Run 'entire enable' first.");
		process.exit(1);
	}

	console.log(`[watch] Monitoring ${metadataDir}`);
	console.log("[watch] Will auto-sync when changes detected");
	console.log("[watch] Press Ctrl+C to stop\n");

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
			console.log(`[watch] Throttled, next sync in ${Math.ceil(wait / 1000)}s`);
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
		console.log("\n[watch] Change detected, syncing...");

		syncCommand()
			.then(() => {
				console.log("[watch] Sync complete, watching...\n");
			})
			.catch((err) => {
				const msg = err instanceof Error ? err.message : String(err);
				console.error(`[watch] Sync failed: ${msg}\n`);
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
		console.log("\n[watch] Stopping...");
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
