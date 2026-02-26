import { useState } from "react";
import type { CodeResult } from "@/api";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface SourceTabProps {
	definition: CodeResult;
}

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<button
			className={`rounded-lg px-2 py-1 text-[10px] transition-colors ${
				copied
					? "bg-emerald-500/10 text-emerald-400"
					: "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
			}`}
			onClick={() => {
				navigator.clipboard.writeText(text);
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			}}
			type="button"
		>
			{copied ? "Copied!" : "Copy"}
		</button>
	);
}

const LANGUAGE_MAP: Record<string, string> = {
	c: "c",
	cpp: "cpp",
	go: "go",
	java: "java",
	javascript: "javascript",
	jsx: "jsx",
	python: "python",
	rust: "rust",
	tsx: "tsx",
	typescript: "typescript",
};

export default function SourceTab({ definition }: SourceTabProps) {
	if (!definition.body) {
		return (
			<div className="py-8 text-center text-sm text-zinc-600">
				Source code not available
			</div>
		);
	}

	const language = LANGUAGE_MAP[definition.language] || "typescript";
	const lineCount = definition.body.split("\n").length;

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="rounded-md bg-zinc-800/60 px-2 py-1 text-[10px] text-zinc-500">
						{definition.language}
					</span>
					<span className="text-[10px] text-zinc-600">{lineCount} lines</span>
				</div>
				<CopyButton text={definition.body} />
			</div>

			<div className="overflow-hidden rounded-xl border border-zinc-800/60">
				<SyntaxHighlighter
					customStyle={{
						background: "#09090b",
						fontSize: "11px",
						lineHeight: "1.6",
						margin: 0,
						padding: "1rem",
					}}
					language={language}
					showLineNumbers
					style={vscDarkPlus}
					wrapLongLines
				>
					{definition.body}
				</SyntaxHighlighter>
			</div>
		</div>
	);
}
