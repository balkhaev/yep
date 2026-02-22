import type { ReactNode } from "react";
import AnimatedNumber from "./charts/AnimatedNumber";

interface StatusCardProps {
	chart?: ReactNode;
	detail?: string;
	label: string;
	value: string | number;
	variant?: "default" | "accent";
}

export default function StatusCard({
	label,
	value,
	detail,
	variant = "default",
	chart,
}: StatusCardProps) {
	const isNumber = typeof value === "number";

	return (
		<div
			className={`card p-5 ${variant === "accent" ? "border-indigo-500/20 bg-indigo-500/5" : ""}`}
		>
			<p className="font-semibold text-[11px] text-zinc-500 uppercase tracking-widest">
				{label}
			</p>
			<div className="mt-2 flex items-end justify-between">
				<p className="font-bold text-2xl tabular-nums tracking-tight">
					{isNumber ? <AnimatedNumber value={value} /> : value}
				</p>
				{chart}
			</div>
			{detail && <p className="mt-1 text-xs text-zinc-500">{detail}</p>}
		</div>
	);
}
