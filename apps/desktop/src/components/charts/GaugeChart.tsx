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

	// Generate gradient colors
	const gradientId = `gauge-gradient-${color.replace("#", "")}`;
	const r = Number.parseInt(color.slice(1, 3), 16);
	const g = Number.parseInt(color.slice(3, 5), 16);
	const b = Number.parseInt(color.slice(5, 7), 16);
	const lighterColor = `rgb(${Math.min(r + 40, 255)}, ${Math.min(g + 40, 255)}, ${Math.min(b + 40, 255)})`;

	return (
		<div className={className} style={{ width: size, height: size }}>
			<svg
				aria-label={`${label}: ${progress}%`}
				height={size}
				role="img"
				viewBox={`0 0 ${size} ${size}`}
				width={size}
			>
				<defs>
					<linearGradient id={gradientId} x1="0%" x2="100%" y1="0%" y2="0%">
						<stop offset="0%" stopColor={color} />
						<stop offset="100%" stopColor={lighterColor} />
					</linearGradient>
					<filter id={`gauge-glow-${color.replace("#", "")}`}>
						<feGaussianBlur in="SourceGraphic" stdDeviation="3" />
						<feComponentTransfer>
							<feFuncA slope="2" type="linear" />
						</feComponentTransfer>
						<feMerge>
							<feMergeNode />
							<feMergeNode in="SourceGraphic" />
						</feMerge>
					</filter>
				</defs>

				{/* Background circle */}
				<circle
					cx={cx}
					cy={cy}
					fill="none"
					r={radius}
					stroke="rgb(63 63 70 / 0.3)"
					strokeWidth="8"
				/>

				{/* Progress arc with gradient and glow */}
				<circle
					cx={cx}
					cy={cy}
					fill="none"
					filter={`url(#gauge-glow-${color.replace("#", "")})`}
					r={radius}
					stroke={`url(#${gradientId})`}
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					strokeLinecap="round"
					strokeWidth="8"
					style={{
						transition: "stroke-dashoffset 1s ease-out",
						transform: "rotate(-90deg)",
						transformOrigin: "center",
					}}
				/>

				{/* Pulsing dot at the end of arc */}
				{progress > 0 && (
					<circle
						cx={cx + radius * Math.cos(((progress * 3.6 - 90) * Math.PI) / 180)}
						cy={cy + radius * Math.sin(((progress * 3.6 - 90) * Math.PI) / 180)}
						fill={color}
						r="4"
						stroke="#18181b"
						strokeWidth="2"
						style={{
							filter: `drop-shadow(0 0 6px ${color})`,
						}}
					>
						<animate
							attributeName="r"
							dur="2s"
							repeatCount="indefinite"
							values="4;5;4"
						/>
					</circle>
				)}

				{/* Center text */}
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
