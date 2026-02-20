import { isInitialized } from "./config.ts";

export function requireInit(): void {
	if (!isInitialized()) {
		console.error("Not initialized. Run 'yep enable' first.");
		process.exit(1);
	}
}
