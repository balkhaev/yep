import { Area, AreaChart, Dot, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "./theme";

interface MiniAreaChartProps {
	className?: string;
	color?: string;
	data: Array<{ value: number }>;
	height?: number;
	showDot?: boolean;
}

export default function MiniAreaChart({
	data,
	color = CHART_COLORS.indigo,
	height = 40,
	showDot = true,
	className,
}: MiniAreaChartProps) {
	if (data.length < 2) {
		return null;
	}

	// Find last non-null value for dot
	const lastIndex = data.length - 1;
	const lastValue = data[lastIndex]?.value;

	return (
		<div className={className} style={{ height }}>
			<ResponsiveContainer height="100%" width="100%">
				<AreaChart
					data={data}
					margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
				>
					<defs>
						<linearGradient
							id={`mini-grad-${color.replace("#", "")}`}
							x1="0"
							x2="0"
							y1="0"
							y2="1"
						>
							<stop offset="0%" stopColor={color} stopOpacity={0.4} />
							<stop offset="50%" stopColor={color} stopOpacity={0.2} />
							<stop offset="100%" stopColor={color} stopOpacity={0} />
						</linearGradient>
					</defs>
					<Area
						activeDot={false}
						animationDuration={1000}
						animationEasing="ease-out"
						dataKey="value"
						dot={false}
						fill={`url(#mini-grad-${color.replace("#", "")})`}
						isAnimationActive
						stroke={color}
						strokeWidth={2}
						type="monotone"
					/>
					{showDot && lastValue !== undefined && (
						<Area
							animationDuration={0}
							dataKey="value"
							dot={(props: any) => {
								if (props.index === lastIndex) {
									return (
										<Dot
											cx={props.cx}
											cy={props.cy}
											fill={color}
											r={3}
											stroke="#18181b"
											strokeWidth={2}
											style={{
												filter: `drop-shadow(0 0 4px ${color})`,
											}}
										/>
									);
								}
								return null;
							}}
							fill="none"
							isAnimationActive={false}
							stroke="none"
							strokeWidth={0}
						/>
					)}
				</AreaChart>
			</ResponsiveContainer>
		</div>
	);
}
