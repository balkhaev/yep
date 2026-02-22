interface Step {
	key: string;
	label: string;
}

interface StepProgressProps {
	className?: string;
	completedSteps: Set<string>;
	currentStep: string | null;
	steps: Step[];
}

export default function StepProgress({
	steps,
	currentStep,
	completedSteps,
	className,
}: StepProgressProps) {
	const currentIdx = currentStep
		? steps.findIndex((s) => s.key === currentStep)
		: -1;

	return (
		<div className={`flex items-center gap-1 ${className ?? ""}`}>
			{steps.map((step, i) => {
				const isCompleted = completedSteps.has(step.key) || currentIdx > i;
				const isCurrent = step.key === currentStep;

				return (
					<div className="flex flex-1 items-center" key={step.key}>
						<div className="flex flex-col items-center gap-1.5">
							<div
								className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300 ${
									isCurrent
										? "border-indigo-500 bg-indigo-500/20"
										: isCompleted
											? "border-emerald-500 bg-emerald-500/20"
											: "border-zinc-700 bg-zinc-900"
								}`}
							>
								{isCompleted && !isCurrent ? (
									<svg
										className="h-3.5 w-3.5 text-emerald-400"
										fill="currentColor"
										viewBox="0 0 16 16"
									>
										<path
											clipRule="evenodd"
											d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
											fillRule="evenodd"
										/>
									</svg>
								) : (
									<span
										className={`font-bold text-xs tabular-nums ${
											isCurrent ? "text-indigo-400" : "text-zinc-600"
										}`}
									>
										{i + 1}
									</span>
								)}
								{isCurrent && (
									<span className="absolute inset-0 animate-ping rounded-full border-2 border-indigo-500/30" />
								)}
							</div>
							<span
								className={`text-center font-medium text-[10px] leading-tight ${
									isCurrent
										? "text-indigo-400"
										: isCompleted
											? "text-emerald-400/70"
											: "text-zinc-600"
								}`}
							>
								{step.label}
							</span>
						</div>
						{i < steps.length - 1 && (
							<div
								className={`mx-1 mb-5 h-px flex-1 transition-colors duration-300 ${
									isCompleted ? "bg-emerald-500/40" : "bg-zinc-800"
								}`}
							/>
						)}
					</div>
				);
			})}
		</div>
	);
}
