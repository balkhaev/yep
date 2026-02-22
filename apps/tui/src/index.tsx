#!/usr/bin/env bun
import { renderTuiApp } from "./app.tsx";
import { contextCommand } from "./mem/commands/context.ts";
import { diffCommand } from "./mem/commands/diff.ts";
import { enableCommand } from "./mem/commands/enable.ts";
import { indexCodeCommand } from "./mem/commands/index-code.ts";
import { resetCommand } from "./mem/commands/reset.ts";
import { searchCommand } from "./mem/commands/search.ts";
import { serveCommand } from "./mem/commands/serve.ts";
import { statusCommand } from "./mem/commands/status.ts";
import { syncCommand } from "./mem/commands/sync.ts";
import { watchCommand } from "./mem/commands/watch.ts";
import { evalCommand } from "./mem/eval/runner.ts";

function printHelp() {
	console.log(`
  yep — agent memory with vector search

  Usage:
    yep enable          Activate Entire + vector memory in this repo
    yep sync            Index new checkpoints into vector store
    yep index-code      Index code symbols (functions, classes, types)
    yep search "..."    Search past solutions by query
    yep context "..."   Output relevant context for piping into prompts
    yep diff <file>     Show memory timeline for a file
    yep watch           Auto-sync on file changes
    yep status          Show indexed chunks, config health, and sync state
    yep reset           Drop vector store and optionally re-index
    yep serve           Start MCP server (stdio, for Cursor)
    yep api             Start HTTP API server (headless, for custom clients)
    yep gui             Launch web GUI in the browser
    yep eval            Run search quality evaluation (A/B comparison)
    yep debug           Debug tools for code index & search

  Run without arguments to launch the interactive TUI.
`);
}

const command = process.argv[2];

switch (command) {
	case "enable":
		await enableCommand();
		break;
	case "sync":
		await syncCommand();
		break;
	case "index-code":
		await indexCodeCommand();
		break;
	case "search":
		await searchCommand(process.argv[3]);
		break;
	case "context":
		await contextCommand(process.argv[3]);
		break;
	case "diff":
		await diffCommand(process.argv[3]);
		break;
	case "watch":
		await watchCommand();
		break;
	case "serve":
		await serveCommand();
		break;
	case "status":
		await statusCommand();
		break;
	case "reset":
		await resetCommand({ reindex: process.argv.includes("--reindex") });
		break;
	case "api": {
		const { apiCommand } = await import("./mem/commands/api.ts");
		const portFlag = process.argv.indexOf("--port");
		const port = portFlag !== -1 ? Number(process.argv[portFlag + 1]) : 3838;
		await apiCommand(port);
		break;
	}
	case "gui": {
		const { guiCommand } = await import("./mem/commands/gui.ts");
		const guiPortFlag = process.argv.indexOf("--port");
		const guiPort =
			guiPortFlag !== -1 ? Number(process.argv[guiPortFlag + 1]) : 3838;
		await guiCommand(guiPort);
		break;
	}
	case "eval":
		await evalCommand();
		break;
	case "debug": {
		const { debugCommand } = await import("./mem/commands/debug.ts");
		await debugCommand();
		break;
	}
	case "--help":
	case "-h":
	case "help":
		printHelp();
		break;
	default: {
		if (command) {
			console.error(`Unknown command: ${command}\n`);
			printHelp();
			process.exit(1);
		}
		const action = await renderTuiApp();
		if (action === "sync") {
			await syncCommand();
			process.exit(0);
		} else if (action === "watch") {
			await watchCommand();
		} else if (action === "reset") {
			await resetCommand({ reindex: false });
			process.exit(0);
		}
		break;
	}
}
