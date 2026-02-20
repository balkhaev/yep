import { resolveOpenAIKey } from "../lib/config.ts";
import { startMcpServer } from "../mcp/server.ts";

export async function serveCommand(): Promise<void> {
	const key = resolveOpenAIKey();
	if (key) {
		process.env.OPENAI_API_KEY = key;
	}
	await startMcpServer();
}
