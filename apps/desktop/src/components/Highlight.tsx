import type { ReactNode } from "react";

const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;
const SPLIT_RE = /\s+/;

function escapeRegex(str: string): string {
	return str.replace(ESCAPE_RE, "\\$&");
}

export default function HighlightText({
	text,
	query,
}: {
	text: string;
	query: string;
}) {
	if (!query.trim()) {
		return <>{text}</>;
	}
	const words = query
		.trim()
		.split(SPLIT_RE)
		.filter((w) => w.length > 1);
	if (words.length === 0) {
		return <>{text}</>;
	}
	const pattern = words.map(escapeRegex).join("|");
	const regex = new RegExp(pattern, "gi");
	const parts: ReactNode[] = [];
	let lastIndex = 0;
	let match = regex.exec(text);
	while (match !== null) {
		if (match.index > lastIndex) {
			parts.push(text.slice(lastIndex, match.index));
		}
		parts.push(
			<mark
				className="rounded-sm bg-indigo-500/25 px-0.5 text-indigo-200"
				key={match.index}
			>
				{match[0]}
			</mark>
		);
		lastIndex = regex.lastIndex;
		match = regex.exec(text);
	}
	if (lastIndex < text.length) {
		parts.push(text.slice(lastIndex));
	}
	return <>{parts}</>;
}
