import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type SolutionResult } from "@/api";
import { Spinner } from "@/components/LoadingState";

interface HistoryTabProps {
	path: string;
}

export default function HistoryTab({ path }: HistoryTabProps) {
	const [loading, setLoading] = useState(true);
	const [history, setHistory] = useState<SolutionResult[]>([]);

	useEffect(() => {
		setLoading(true);
		api
			.diff(path)
			.then((res) => setHistory(res.results))
			.catch(() => setHistory([]))
			.finally(() => setLoading(false));
	}, [path]);

	if (loading) {
		return (
			<div className="flex h-32 items-center justify-center">
				<Spinner />
			</div>
		);
	}

	if (history.length === 0) {
		return (
			<div className="py-8 text-center text-sm text-zinc-600">
				No change history available
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<p className="text-xs text-zinc-600">
				{history.length} change{history.length !== 1 ? "s" : ""} recorded
			</p>

			<div className="space-y-2">
				{history.slice(0, 10).map((item) => (
					<Link
						className="block rounded-lg border border-zinc-800/40 bg-zinc-900/40 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-800/60"
						key={item.id}
						to={`/diff?file=${encodeURIComponent(path)}`}
					>
						<div className="mb-1 flex items-center gap-2">
							{item.agent && <span className="badge">{item.agent}</span>}
							{item.timestamp && (
								<span className="text-[10px] text-zinc-600">
									{new Date(item.timestamp).toLocaleDateString("en-US", {
										day: "numeric",
										hour: "2-digit",
										minute: "2-digit",
										month: "short",
									})}
								</span>
							)}
						</div>
						<p className="text-[12px] text-zinc-400 leading-relaxed">
							{item.summary || item.prompt.slice(0, 150)}
						</p>
						{item.symbols && (
							<div className="mt-2 flex flex-wrap gap-1">
								{item.symbols
									.split(",")
									.slice(0, 3)
									.map((s) => {
										const trimmed = s.trim();
										return trimmed ? (
											<span className="badge-accent font-mono" key={trimmed}>
												{trimmed}
											</span>
										) : null;
									})}
							</div>
						)}
					</Link>
				))}
			</div>

			{history.length > 10 && (
				<Link
					className="block text-center text-xs text-indigo-400 hover:text-indigo-300"
					to={`/diff?file=${encodeURIComponent(path)}`}
				>
					View all {history.length} changes →
				</Link>
			)}
		</div>
	);
}
