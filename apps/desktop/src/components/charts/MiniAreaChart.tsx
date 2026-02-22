import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "./theme";

interface MiniAreaChartProps {
	className?: string;
	color?: string;
	data: Array<{ value: number }>;
	height?: number;
}

export default function MiniAreaChart({
	data,
	color = CHART_COLORS.indigo,
	height = 40,
	className,
}: MiniAreaChartProps) {
	if (data.length < 2) {
		return null;
	}

	return (
		<div className={className} style={{ height }}>
			<ResponsiveContainer height="100%" width="100%">
				<AreaChart
					data={data}
					margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
				>
					<defs>
						<linearGradient
							id={`mini-grad-${color}`}
							x1="0"
							x2="0"
							y1="0"
							y2="1"
						>
							<stop offset="0%" stopColor={color} stopOpacity={0.3} />
							<stop offset="100%" stopColor={color} stopOpacity={0} />
						</linearGradient>
					</defs>
					<Area
						animationDuration={800}
						dataKey="value"
						fill={`url(#mini-grad-${color})`}
						stroke={color}
						strokeWidth={1.5}
						type="monotone"
					/>
				</AreaChart>
			</ResponsiveContainer>
		</div>
	);
}
