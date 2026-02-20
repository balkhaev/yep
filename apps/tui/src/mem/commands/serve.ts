import { ensureProviderReady } from "../lib/config.ts";
import { startMcpServer } from "../mcp/server.ts";

export async function serveCommand(): Promise<void> {
	ensureProviderReady();
	await startMcpServer();
}
