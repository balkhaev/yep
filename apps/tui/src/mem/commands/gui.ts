import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isInitialized } from "../lib/config.ts";

const __dirname =
	import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));

const MIME_TYPES: Record<string, string> = {
	".html": "text/html",
	".js": "application/javascript",
	".css": "text/css",
	".json": "application/json",
	".svg": "image/svg+xml",
	".png": "image/png",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
};

function resolveGuiDist(): string | null {
	const candidates = [
		resolve(__dirname, "../../../gui-dist"),
		resolve(__dirname, "../../../../desktop/dist"),
	];

	for (const dir of candidates) {
		if (existsSync(join(dir, "index.html"))) {
			return dir;
		}
	}
	return null;
}

function openBrowser(url: string): void {
	const commands: Record<string, string> = {
		darwin: "open",
		win32: "start",
	};
	exec(`${commands[process.platform] ?? "xdg-open"} ${url}`);
}

export async function guiCommand(port = 3838): Promise<void> {
	if (!isInitialized()) {
		console.error("Not initialized. Run 'yep enable' first.");
		process.exit(1);
	}

	const guiDist = resolveGuiDist();
	if (!guiDist) {
		console.error(
			"GUI assets not found. Build them first:\n  bun run build:gui"
		);
		process.exit(1);
	}

	const { apiApp } = await import("./api.ts");
	const indexHtml = join(guiDist, "index.html");

	apiApp.get("/*", async (c) => {
		const reqPath = c.req.path === "/" ? "/index.html" : c.req.path;
		const filePath = join(guiDist, reqPath);

		const file = Bun.file(filePath);
		if (await file.exists()) {
			const mime = MIME_TYPES[extname(filePath)] ?? "application/octet-stream";
			return new Response(file, {
				headers: { "Content-Type": mime },
			});
		}

		return new Response(Bun.file(indexHtml), {
			headers: { "Content-Type": "text/html" },
		});
	});

	const url = `http://localhost:${port}`;
	console.log(`Starting yep GUI on ${url}`);
	Bun.serve({ fetch: apiApp.fetch, port });
	openBrowser(url);
	console.log(`GUI running at ${url}`);

	backgroundCodeIndex();
}

async function isIndexStale(): Promise<boolean> {
	const { readConfig } = await import("../lib/config.ts");
	const config = readConfig();
	const hasApiKey = config.provider === "ollama" || config.openaiApiKey;
	if (!hasApiKey) {
		return false;
	}
	if (!config.lastCodeIndexCommit) {
		return true;
	}
	try {
		const proc = Bun.spawn(["git", "rev-parse", "HEAD"], {
			stdout: "pipe",
			stderr: "pipe",
		});
		const head = (await new Response(proc.stdout).text()).trim();
		await proc.exited;
		return head !== config.lastCodeIndexCommit;
	} catch {
		return false;
	}
}

function backgroundCodeIndex(): void {
	isIndexStale().then(async (needsIndex) => {
		if (!needsIndex) {
			return;
		}
		console.log("[background] Code index is stale, re-indexing...");
		try {
			const { ensureProviderReady } = await import("../lib/config.ts");
			ensureProviderReady();
			const { runCodeIndex } = await import("./index-code.ts");
			const result = await runCodeIndex((msg) =>
				console.log(`[background] ${msg}`)
			);
			if (!result.skipped) {
				console.log(
					`[background] Indexed ${result.totalSymbols} symbols from ${result.totalFiles} files`
				);
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.log(`[background] Code index failed: ${msg}`);
		}
	});
}
