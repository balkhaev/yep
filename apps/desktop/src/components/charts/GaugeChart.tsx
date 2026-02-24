interface GaugeChartProps {
	className?: string;
	color?: string;
	label: string;
	size?: number;
	value: number;
}

export default function GaugeChart({
	value,
	label,
	size = 140,
	color = "#6366f1",
	className,
}: GaugeChartProps) {
	const radius = (size - 16) / 2;
	const circumference = 2 * Math.PI * radius;
	const progress = Math.min(Math.max(value, 0), 100);
	const offset = circumference - (progress / 100) * circumference;
	const cx = size / 2;
	const cy = size / 2;

	return (
		<div className={className} style={{ width: size, height: size }}>
			<svg
				aria-label={`${label}: ${progress}%`}
				height={size}
				role="img"
				viewBox={`0 0 ${size} ${size}`}
				width={size}
			>
				<circle
					cx={cx}
					cy={cy}
					fill="none"
					r={radius}
					stroke="rgb(63 63 70 / 0.3)"
					strokeWidth="8"
				/>
				<circle
					cx={cx}
					cy={cy}
					fill="none"
					r={radius}
					stroke={color}
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					strokeLinecap="round"
					strokeWidth="8"
					style={{
						transition: "stroke-dashoffset 0.8s ease-in-out",
						transform: "rotate(-90deg)",
						transformOrigin: "center",
					}}
				/>
				<text
					dominantBaseline="central"
					fill="#e4e4e7"
					fontSize="22"
					fontWeight="700"
					textAnchor="middle"
					x={cx}
					y={cy - 8}
				>
					{progress}%
				</text>
				<text
					dominantBaseline="central"
					fill="#71717a"
					fontSize="10"
					textAnchor="middle"
					x={cx}
					y={cy + 12}
				>
					{label}
				</text>
			</svg>
		</div>
	);
}
