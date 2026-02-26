import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type SyncEvent } from "@/api";
import AnimatedNumber from "@/components/charts/AnimatedNumber";
import StepProgress from "@/components/charts/StepProgress";
import { FadeInUp } from "@/components/Motion";
import PageHeader from "@/components/PageHeader";
import { queryKeys } from "@/hooks/queries";

interface LogEntry {
	id: number;
	message: string;
	step?: string;
	timestamp: Date;
	type: "progress" | "done" | "error";
}

const SYNC_STEPS = [
	{ key: "parsing", label: "Parse" },
	{ key: "chunking", label: "Chunk" },
	{ key: "summarizing", label: "Summarize" },
	{ key: "embedding", label: "Embed" },
	{ key: "indexing", label: "Index" },
];

export default function Sync() {
	const queryClient = useQueryClient();
	const [syncing, setSyncing] = useState(false);
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [finished, setFinished] = useState<{
		success: boolean;
		total?: number;
	} | null>(null);
	const [currentStep, setCurrentStep] = useState<string | null>(null);
	const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
	const [startTime, setStartTime] = useState<number | null>(null);
	const [elapsed, setElapsed] = useState(0);
	const controllerRef = useRef<AbortController | null>(null);
	const idRef = useRef(0);
	const logEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!(syncing && startTime)) {
			return;
		}
		const id = setInterval(() => setElapsed(Date.now() - startTime), 200);
		return () => clearInterval(id);
	}, [syncing, startTime]);

	const addLog = useCallback(
		(type: LogEntry["type"], message: string, step?: string) => {
			idRef.current += 1;
			if (step && step !== currentStep) {
				setCompletedSteps((prev) => {
					if (currentStep) {
						const next = new Set(prev);
						next.add(currentStep);
						return next;
					}
					return prev;
				});
				setCurrentStep(step);
			}
			setLogs((prev) => [
				...prev,
				{ id: idRef.current, type, message, step, timestamp: new Date() },
			]);
			setTimeout(
				() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }),
				50
			);
		},
		[currentStep]
	);

	const handleSync = useCallback(() => {
		setSyncing(true);
		setFinished(null);
		setCurrentStep(null);
		setCompletedSteps(new Set());
		setLogs([]);
		setStartTime(Date.now());
		setElapsed(0);

		const controller = api.sync((event: SyncEvent) => {
			switch (event.event) {
				case "progress":
					addLog("progress", event.data.message, event.data.step);
					break;
				case "done":
					addLog("done", event.data.message);
					setFinished({ success: true, total: event.data.total });
					setSyncing(false);
					setCurrentStep(null);
					setCompletedSteps(new Set(SYNC_STEPS.map((s) => s.key)));
					queryClient.invalidateQueries({ queryKey: queryKeys.codeInsights });
					queryClient.invalidateQueries({
						queryKey: queryKeys.codeRecommendations,
					});
					break;
				case "error":
					addLog("error", event.data.message);
					setFinished({ success: false });
					setSyncing(false);
					setCurrentStep(null);
					break;
				default:
					break;
			}
		});

		controllerRef.current = controller;
	}, [addLog]);

	const handleCancel = useCallback(() => {
		controllerRef.current?.abort();
		setSyncing(false);
		setCurrentStep(null);
		addLog("error", "Sync cancelled by user");
		setFinished({ success: false });
	}, [addLog]);

	const progressCount = logs.filter((l) => l.type === "progress").length;
	const elapsedSec = Math.round(elapsed / 1000);

	const completedStepCount = completedSteps.size;
	const totalStepCount = SYNC_STEPS.length;
	const currentStepIndex = currentStep
		? SYNC_STEPS.findIndex((s) => s.key === currentStep)
		: -1;
	const progressFraction =
		totalStepCount > 0
			? (completedStepCount + (currentStepIndex >= 0 ? 0.5 : 0)) /
				totalStepCount
			: 0;
	const progressPercent = Math.min(Math.round(progressFraction * 100), 99);
	const estimatedRemainingSec =
		progressFraction > 0.05 && elapsed > 2000
			? Math.round((elapsed / progressFraction - elapsed) / 1000)
			: null;

	return (
		<div className="space-y-8">
			<PageHeader
				subtitle="Index new checkpoints into the vector store"
				title="Sync"
			/>

			{(syncing || finished) && (
				<FadeInUp className="card space-y-4 p-6">
					<StepProgress
						completedSteps={completedSteps}
						currentStep={currentStep}
						steps={SYNC_STEPS}
					/>
					{syncing && (
						<div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
							<div
								className="h-full rounded-full bg-indigo-500 transition-all duration-500"
								style={{ width: `${progressPercent}%` }}
							/>
						</div>
					)}
				</FadeInUp>
			)}

			<FadeInUp className="card p-6" delay={0.1}>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						{syncing ? (
							<button
								className="btn-danger"
								onClick={handleCancel}
								type="button"
							>
								Cancel
							</button>
						) : (
							<button
								className="btn-primary"
								onClick={handleSync}
								type="button"
							>
								Start Sync
							</button>
						)}

						{syncing && (
							<div className="flex items-center gap-6">
								<div className="flex items-center gap-2">
									<div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
									<span className="font-medium text-sm text-zinc-300">
										Syncing...
									</span>
									<span className="font-mono text-indigo-400 text-sm tabular-nums">
										{progressPercent}%
									</span>
								</div>
								<div className="flex items-center gap-4 text-xs text-zinc-500">
									<span className="tabular-nums">
										<AnimatedNumber value={progressCount} /> steps
									</span>
									<span className="tabular-nums">{elapsedSec}s elapsed</span>
									{estimatedRemainingSec !== null &&
										estimatedRemainingSec > 0 && (
											<span className="tabular-nums">
												~{estimatedRemainingSec}s remaining
											</span>
										)}
								</div>
							</div>
						)}
					</div>

					{finished && (
						<div
							className={`flex items-center gap-2 rounded-xl px-3 py-1.5 font-medium text-xs ${
								finished.success
									? "bg-emerald-500/10 text-emerald-400"
									: "bg-red-500/10 text-red-400"
							}`}
						>
							<span
								className={`h-1.5 w-1.5 rounded-full ${finished.success ? "bg-emerald-400" : "bg-red-400"}`}
							/>
							{finished.success
								? `${finished.total ?? 0} chunk${finished.total !== 1 ? "s" : ""} indexed`
								: "Failed"}
							{finished.success && elapsedSec > 0 && (
								<span className="ml-1 text-emerald-500/70">
									in {elapsedSec}s
								</span>
							)}
						</div>
					)}
				</div>
			</FadeInUp>

			{logs.length > 0 && (
				<FadeInUp className="card overflow-hidden" delay={0.2}>
					<div className="flex items-center justify-between border-zinc-800/40 border-b px-5 py-3">
						<span className="font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
							Log Output
						</span>
						<span className="text-[11px] text-zinc-700 tabular-nums">
							{logs.length} entries
						</span>
					</div>
					<div className="max-h-[420px] overflow-y-auto p-4">
						{logs.map((entry) => (
							<div className="flex gap-3 py-1 font-mono text-xs" key={entry.id}>
								<span className="shrink-0 text-zinc-700 tabular-nums">
									{entry.timestamp.toLocaleTimeString()}
								</span>
								<span
									className={`flex items-center gap-1.5 ${
										entry.type === "error"
											? "text-red-400"
											: entry.type === "done"
												? "text-emerald-400"
												: "text-zinc-400"
									}`}
								>
									{entry.type === "error" && (
										<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
									)}
									{entry.type === "done" && (
										<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
									)}
									{entry.step && (
										<span className="mr-1 rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-zinc-500">
											{entry.step}
										</span>
									)}
									{entry.message}
								</span>
							</div>
						))}
						<div ref={logEndRef} />
					</div>
				</FadeInUp>
			)}

			{logs.length === 0 && !syncing && (
				<div className="flex h-48 items-center justify-center">
					<div className="text-center">
						<div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-800/60">
							<svg
								aria-hidden="true"
								className="h-5 w-5 text-zinc-600"
								fill="currentColor"
								viewBox="0 0 16 16"
							>
								<path
									clipRule="evenodd"
									d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08.932.75.75 0 0 1-1.3-.75 6 6 0 0 1 9.44-1.242l.842.84V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44 1.241l-.84-.84v1.371a.75.75 0 0 1-1.5 0V9.591a.75.75 0 0 1 .75-.75H5.35a.75.75 0 0 1 0 1.5H3.98l.841.841a4.5 4.5 0 0 0 7.08-.932.75.75 0 0 1 1.025-.273Z"
									fillRule="evenodd"
								/>
							</svg>
						</div>
						<p className="text-sm text-zinc-500">Ready to sync</p>
						<p className="mt-1 text-xs text-zinc-600">
							Click "Start Sync" to index new checkpoints
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
