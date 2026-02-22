interface ScoreRingProps {
	className?: string;
	score: number;
	size?: number;
	strokeWidth?: number;
}

function getColor(score: number): string {
	if (score >= 0.7) {
		return "#10b981";
	}
	if (score >= 0.4) {
		return "#f59e0b";
	}
	return "#71717a";
}

export default function ScoreRing({
	score,
	size = 36,
	strokeWidth = 3,
	className,
}: ScoreRingProps) {
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference * (1 - Math.min(score, 1));
	const color = getColor(score);
	const pct = Math.round(score * 100);

	return (
		<div
			className={`relative inline-flex shrink-0 items-center justify-center ${className ?? ""}`}
			style={{ width: size, height: size }}
		>
			<svg height={size} width={size}>
				<circle
					cx={size / 2}
					cy={size / 2}
					fill="none"
					r={radius}
					stroke="rgb(63 63 70 / 0.3)"
					strokeWidth={strokeWidth}
				/>
				<circle
					cx={size / 2}
					cy={size / 2}
					fill="none"
					r={radius}
					stroke={color}
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					strokeLinecap="round"
					strokeWidth={strokeWidth}
					style={{
						transition: "stroke-dashoffset 0.6s ease-out",
						transform: "rotate(-90deg)",
						transformOrigin: "center",
					}}
				/>
			</svg>
			<span
				className="absolute font-bold tabular-nums"
				style={{ fontSize: size * 0.28, color }}
			>
				{pct}
			</span>
		</div>
	);
}
