import {
	type FormEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { api, type SearchResult, type UnifiedResult } from "@/api";
import AnimatedNumber from "@/components/charts/AnimatedNumber";
import MiniAreaChart from "@/components/charts/MiniAreaChart";
import ScoreRing from "@/components/charts/ScoreRing";
import HighlightText from "@/components/Highlight";
import SearchResultCard from "@/components/SearchResult";
import { useStatus } from "@/hooks/queries";

function useDebounce<T>(value: T, delay: number): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delay);
		return () => clearTimeout(timer);
	}, [value, delay]);
	return debounced;
}

type SearchSource = "all" | "transcript" | "code";

const SOURCE_TABS: { label: string; value: SearchSource }[] = [
	{ label: "All", value: "all" },
	{ label: "Transcripts", value: "transcript" },
	{ label: "Code", value: "code" },
];

const placeholderBySource: Record<SearchSource, string> = {
	all: "Search sessions and code...",
	transcript: "Search past sessions...",
	code: "Search code symbols...",
};

const EXAMPLE_QUERIES: Record<SearchSource, string[]> = {
	all: [
		"authentication flow",
		"database migration",
		"error handling",
		"API endpoint",
	],
	transcript: [
		"refactored the login page",
		"fixed memory leak",
		"added tests for",
		"updated dependencies",
	],
	code: ["parseConfig", "useAuth", "handleRequest", "validateInput"],
};

function EmptyState({
	source,
	onExampleClick,
}: {
	source: SearchSource;
	onExampleClick: (query: string) => void;
}) {
	return (
		<div className="fade-in-up flex flex-col items-center justify-center py-16 text-center">
			<svg
				aria-hidden="true"
				className="mb-4 h-10 w-10 text-zinc-700"
				fill="none"
				stroke="currentColor"
				strokeWidth={1.5}
				viewBox="0 0 24 24"
			>
				<path
					d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
			<p className="mb-1 text-sm text-zinc-400">
				Search your coding sessions and codebase
			</p>
			<p className="mb-5 text-xs text-zinc-600">Try one of these</p>
			<div className="flex flex-wrap justify-center gap-2">
				{EXAMPLE_QUERIES[source].map((q) => (
					<button
						className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
						key={q}
						onClick={() => onExampleClick(q)}
						type="button"
					>
						{q}
					</button>
				))}
			</div>
		</div>
	);
}

function NoResults({ source }: { source: SearchSource }) {
	return (
		<div className="flex h-32 items-center justify-center">
			<p className="text-sm text-zinc-500">
				No results found. Try a different query
				{source === "code" && " or run "}
				{source === "code" && (
					<code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-300">
						yep index-code
					</code>
				)}
				{source === "transcript" && " or run "}
				{source === "transcript" && (
					<code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-300">
						yep sync
					</code>
				)}
			</p>
		</div>
	);
}

function SymbolTypeBadge({ type }: { type: string }) {
	const colors: Record<string, string> = {
		function: "text-blue-400 bg-blue-500/10",
		class: "text-purple-400 bg-purple-500/10",
		interface: "text-cyan-400 bg-cyan-500/10",
		type: "text-green-400 bg-green-500/10",
		component: "text-orange-400 bg-orange-500/10",
	};
	return (
		<span
			className={`rounded-lg px-2 py-0.5 font-semibold text-[10px] uppercase tracking-wider ${colors[type] ?? "bg-zinc-800 text-zinc-400"}`}
		>
			{type}
		</span>
	);
}

function CodeResultCard({
	result,
	index,
	query,
}: {
	result: UnifiedResult;
	index: number;
	query: string;
}) {
	const [expanded, setExpanded] = useState(false);

	return (
		<div
			className={`card-hover group fade-in-up stagger-${Math.min(index + 1, 8)}`}
		>
			<button
				className="w-full px-5 py-4 text-left"
				onClick={() => setExpanded(!expanded)}
				type="button"
			>
				<div className="flex items-start gap-4">
					<ScoreRing score={result.score} size={40} strokeWidth={3} />
					<div className="min-w-0 flex-1">
						<div className="mb-1.5 flex flex-wrap items-center gap-2">
							{result.symbolType && (
								<SymbolTypeBadge type={result.symbolType} />
							)}
							<span className="font-mono font-semibold text-sm text-zinc-200">
								<HighlightText query={query} text={result.symbol ?? ""} />
							</span>
							<span className="rounded-lg bg-indigo-500/10 px-2 py-0.5 font-medium text-[10px] text-indigo-400">
								code
							</span>
						</div>
						{result.path && (
							<p className="truncate font-mono text-[11px] text-zinc-600">
								<HighlightText query={query} text={result.path} />
							</p>
						)}
						{result.summary && (
							<p className="mt-1 text-[13px] text-zinc-400 leading-relaxed">
								<HighlightText
									query={query}
									text={result.summary.slice(0, 200)}
								/>
							</p>
						)}
					</div>
					<svg
						aria-hidden="true"
						className={`mt-1 h-3.5 w-3.5 shrink-0 text-zinc-600 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
						fill="currentColor"
						viewBox="0 0 16 16"
					>
						<path
							clipRule="evenodd"
							d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
							fillRule="evenodd"
						/>
					</svg>
				</div>
			</button>
			{expanded && result.body && (
				<div className="border-zinc-800/40 border-t px-5 py-4">
					<pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-950/80 p-4 font-mono text-xs text-zinc-300 leading-relaxed">
						{result.body}
					</pre>
				</div>
			)}
		</div>
	);
}

function ScoreDistribution({ scores }: { scores: number[] }) {
	if (scores.length === 0) {
		return null;
	}

	const buckets = Array.from({ length: 10 }, (_, i) => {
		const lo = i / 10;
		const hi = (i + 1) / 10;
		return { value: scores.filter((s) => s >= lo && s < hi).length };
	});

	return <MiniAreaChart className="w-full" data={buckets} height={32} />;
}

export default function Search() {
	const [query, setQuery] = useState("");
	const [source, setSource] = useState<SearchSource>("all");
	const [transcriptResults, setTranscriptResults] = useState<SearchResult[]>(
		[]
	);
	const [unifiedResults, setUnifiedResults] = useState<UnifiedResult[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [searched, setSearched] = useState(false);
	const [searchTime, setSearchTime] = useState<number | null>(null);

	const [topK, setTopK] = useState(5);
	const [minScore, setMinScore] = useState(0.3);
	const [agentFilter, setAgentFilter] = useState("");
	const [fileFilter, setFileFilter] = useState("");
	const [agents, setAgents] = useState<string[]>([]);
	const [showFilters, setShowFilters] = useState(false);

	const debouncedQuery = useDebounce(query, 400);
	const inputRef = useRef<HTMLInputElement>(null);
	const loadingRef = useRef(false);
	const { data: statusData } = useStatus();

	useEffect(() => {
		if (statusData?.stats?.agents) {
			setAgents(statusData.stats.agents);
		}
	}, [statusData]);

	useEffect(() => {
		inputRef.current?.focus();

		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				inputRef.current?.focus();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);

	const runTranscriptSearch = useCallback(
		async (searchQuery: string) => {
			const files = fileFilter
				.split(",")
				.map((f) => f.trim())
				.filter(Boolean);
			const res = await api.search({
				query: searchQuery,
				top_k: topK,
				min_score: minScore,
				agent: agentFilter || undefined,
				files: files.length > 0 ? files : undefined,
			});
			setTranscriptResults(res.results);
			setUnifiedResults([]);
		},
		[topK, minScore, agentFilter, fileFilter]
	);

	const runUnifiedSearch = useCallback(
		async (searchQuery: string) => {
			const res = await api.searchAll({
				query: searchQuery,
				top_k: topK,
				source,
				min_score: minScore,
			});
			setUnifiedResults(res.results);
			setTranscriptResults([]);
		},
		[topK, source, minScore]
	);

	const handleSearch = useCallback(
		async (e?: FormEvent, overrideQuery?: string) => {
			e?.preventDefault();
			const searchQuery = (overrideQuery ?? query).trim();
			if (!searchQuery || loadingRef.current) {
				return;
			}

			loadingRef.current = true;
			setLoading(true);
			setError(null);
			setSearched(true);
			const start = performance.now();

			try {
				if (source === "transcript") {
					await runTranscriptSearch(searchQuery);
				} else {
					await runUnifiedSearch(searchQuery);
				}
				setSearchTime(Math.round(performance.now() - start));
			} catch (err) {
				setError(err instanceof Error ? err.message : "Search failed");
			} finally {
				setLoading(false);
				loadingRef.current = false;
			}
		},
		[query, source, runTranscriptSearch, runUnifiedSearch]
	);

	const handleSearchRef = useRef(handleSearch);
	handleSearchRef.current = handleSearch;

	useEffect(() => {
		if (!debouncedQuery.trim()) {
			return;
		}
		let cancelled = false;
		const run = async () => {
			if (!cancelled) {
				await handleSearchRef.current(undefined, debouncedQuery);
			}
		};
		run();
		return () => {
			cancelled = true;
		};
	}, [debouncedQuery]);

	const handleExampleClick = useCallback((exampleQuery: string) => {
		setQuery(exampleQuery);
		handleSearchRef.current(undefined, exampleQuery);
	}, []);

	const handleClear = useCallback(() => {
		setQuery("");
		setSearched(false);
		setTranscriptResults([]);
		setUnifiedResults([]);
		setError(null);
		inputRef.current?.focus();
	}, []);

	const totalResults =
		source === "transcript" ? transcriptResults.length : unifiedResults.length;

	const allScores =
		source === "transcript"
			? transcriptResults.map((r) => r.score)
			: unifiedResults.map((r) => r.score);

	return (
		<div className="space-y-4">
			<div className="flex gap-1 rounded-xl bg-zinc-900/60 p-1">
				{SOURCE_TABS.map((tab) => (
					<button
						className={`flex-1 rounded-lg px-3 py-2 font-medium text-sm transition-all ${
							source === tab.value
								? "bg-zinc-800 text-white shadow-sm"
								: "text-zinc-500 hover:text-zinc-300"
						}`}
						key={tab.value}
						onClick={() => setSource(tab.value)}
						type="button"
					>
						{tab.label}
					</button>
				))}
			</div>

			<form className="flex gap-2" onSubmit={handleSearch}>
				<div className="relative flex-1">
					<input
						className={`input w-full ${query ? "pr-24" : "pr-20"}`}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={placeholderBySource[source]}
						ref={inputRef}
						type="text"
						value={query}
					/>
					{query && (
						<button
							className="absolute top-1/2 right-14 -translate-y-1/2 rounded-md p-1 text-zinc-500 transition-colors hover:text-zinc-300"
							onClick={handleClear}
							type="button"
						>
							<svg
								aria-hidden="true"
								className="h-3.5 w-3.5"
								fill="currentColor"
								viewBox="0 0 16 16"
							>
								<path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
							</svg>
						</button>
					)}
					<kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-md border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
						Cmd+K
					</kbd>
				</div>
				<button
					className="btn-primary"
					disabled={loading || !query.trim()}
					type="submit"
				>
					{loading ? (
						<div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
					) : (
						"Search"
					)}
				</button>
				<button
					className={`rounded-xl border px-3 py-2.5 text-sm transition-colors ${
						showFilters
							? "border-zinc-600 bg-zinc-800 text-white"
							: "border-zinc-800/60 text-zinc-400 hover:text-zinc-200"
					}`}
					onClick={() => setShowFilters(!showFilters)}
					type="button"
				>
					<svg
						aria-hidden="true"
						className="h-4 w-4"
						fill="currentColor"
						viewBox="0 0 16 16"
					>
						<path d="M6.955 1.45A.5.5 0 0 1 7.452 1h1.096a.5.5 0 0 1 .497.45l.17 1.699c.484.12.94.312 1.356.562l1.321-.916a.5.5 0 0 1 .67.033l.774.775a.5.5 0 0 1 .034.67l-.916 1.32c.25.417.44.873.561 1.357l1.699.17a.5.5 0 0 1 .45.497v1.096a.5.5 0 0 1-.45.497l-1.699.17c-.12.484-.312.94-.562 1.356l.916 1.321a.5.5 0 0 1-.033.67l-.775.774a.5.5 0 0 1-.67.033l-1.32-.916c-.417.25-.873.44-1.357.561l-.17 1.699a.5.5 0 0 1-.497.45H7.452a.5.5 0 0 1-.497-.45l-.17-1.699a4.973 4.973 0 0 1-1.356-.562l-1.321.916a.5.5 0 0 1-.67-.033l-.774-.775a.5.5 0 0 1-.034-.67l.916-1.32a4.971 4.971 0 0 1-.561-1.357l-1.699-.17A.5.5 0 0 1 1 8.548V7.452a.5.5 0 0 1 .45-.497l1.699-.17c.12-.484.312-.94.562-1.356l-.916-1.321a.5.5 0 0 1 .033-.67l.775-.774a.5.5 0 0 1 .67-.033l1.32.916c.417-.25.873-.44 1.357-.561l.17-1.699ZM8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
					</svg>
				</button>
			</form>

			{showFilters && (
				<div className="card fade-in-up flex flex-wrap gap-4 px-4 py-3">
					<label className="flex items-center gap-2 text-sm text-zinc-400">
						Results
						<input
							className="w-16 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200 outline-none"
							max={20}
							min={1}
							onChange={(e) => setTopK(Number(e.target.value))}
							type="number"
							value={topK}
						/>
					</label>
					<label className="flex items-center gap-2 text-sm text-zinc-400">
						Min score
						<input
							className="w-20 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200 outline-none"
							max={1}
							min={0}
							onChange={(e) => setMinScore(Number(e.target.value))}
							step={0.05}
							type="number"
							value={minScore}
						/>
					</label>
					{source === "transcript" && agents.length > 0 && (
						<label className="flex items-center gap-2 text-sm text-zinc-400">
							Agent
							<select
								className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200 outline-none"
								onChange={(e) => setAgentFilter(e.target.value)}
								value={agentFilter}
							>
								<option value="">All</option>
								{agents.map((a) => (
									<option key={a} value={a}>
										{a}
									</option>
								))}
							</select>
						</label>
					)}
					{source === "transcript" && (
						<label className="flex items-center gap-2 text-sm text-zinc-400">
							Files
							<input
								className="w-48 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200 placeholder-zinc-600 outline-none"
								onChange={(e) => setFileFilter(e.target.value)}
								placeholder="path1, path2"
								type="text"
								value={fileFilter}
							/>
						</label>
					)}
				</div>
			)}

			{error && (
				<div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-red-400 text-sm">
					{error}
				</div>
			)}

			{!(searched || loading) && (
				<EmptyState onExampleClick={handleExampleClick} source={source} />
			)}

			{searched && !loading && (
				<div className="flex items-center gap-4">
					<p className="text-xs text-zinc-600">
						{totalResults} result{totalResults !== 1 && "s"}
						{searchTime !== null && (
							<>
								{" "}
								in{" "}
								<span className="text-zinc-400 tabular-nums">
									<AnimatedNumber duration={400} value={searchTime} />
									ms
								</span>
							</>
						)}
					</p>
					{allScores.length > 0 && (
						<div className="flex-1">
							<ScoreDistribution scores={allScores} />
						</div>
					)}
				</div>
			)}

			{source === "transcript" && transcriptResults.length > 0 && (
				<div className="space-y-3">
					{transcriptResults.map((r, i) => (
						<SearchResultCard
							index={i}
							key={r.chunk.id}
							query={query}
							result={r}
						/>
					))}
				</div>
			)}

			{source !== "transcript" && unifiedResults.length > 0 && (
				<div className="space-y-3">
					{unifiedResults.map((r, i) =>
						r.source === "code" ? (
							<CodeResultCard index={i} key={r.id} query={query} result={r} />
						) : (
							<SearchResultCard
								index={i}
								key={r.id}
								query={query}
								result={{
									score: r.score,
									chunk: {
										id: r.id,
										summary: r.summary,
										prompt: r.prompt ?? "",
										response: r.response ?? "",
										filesChanged: r.filesChanged ?? "",
										timestamp: r.timestamp ?? "",
										diffSummary: "",
										embeddingText: "",
										agent: "",
										checkpointId: "",
										confidence: 0,
										language: "",
										scope: "",
										sessionIndex: 0,
										source: "transcript",
										symbols: "",
										tokensUsed: 0,
										version: 0,
									},
								}}
							/>
						)
					)}
				</div>
			)}

			{searched && !loading && totalResults === 0 && !error && (
				<NoResults source={source} />
			)}
		</div>
	);
}
