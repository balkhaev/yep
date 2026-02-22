import {
	PolarAngleAxis,
	PolarGrid,
	Radar,
	RadarChart,
	ResponsiveContainer,
} from "recharts";
import { CHART_COLORS } from "./theme";

interface RadarHealthProps {
	className?: string;
	color?: string;
	data: Array<{ axis: string; value: number }>;
	size?: number;
}

export default function RadarHealth({
	data,
	size = 220,
	color = CHART_COLORS.indigo,
	className,
}: RadarHealthProps) {
	return (
		<div className={className} style={{ width: size, height: size }}>
			<ResponsiveContainer>
				<RadarChart cx="50%" cy="50%" data={data} outerRadius="72%">
					<PolarGrid stroke="rgb(63 63 70 / 0.3)" />
					<PolarAngleAxis
						dataKey="axis"
						fontSize={10}
						tick={{ fill: "#a1a1aa" }}
					/>
					<Radar
						animationDuration={600}
						dataKey="value"
						fill={color}
						fillOpacity={0.15}
						stroke={color}
						strokeWidth={2}
					/>
				</RadarChart>
			</ResponsiveContainer>
		</div>
	);
}
