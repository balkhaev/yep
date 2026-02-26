import {
	PolarAngleAxis,
	PolarGrid,
	Radar,
	RadarChart,
	ResponsiveContainer,
	Tooltip,
} from "recharts";
import { CHART_COLORS, TOOLTIP_STYLE_GLASS } from "./theme";

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
	const gradientId = `radar-gradient-${color.replace("#", "")}`;

	return (
		<div className={className} style={{ width: size, height: size }}>
			<ResponsiveContainer>
				<RadarChart cx="50%" cy="50%" data={data} outerRadius="72%">
					<defs>
						<radialGradient id={gradientId}>
							<stop offset="0%" stopColor={color} stopOpacity={0.3} />
							<stop offset="100%" stopColor={color} stopOpacity={0} />
						</radialGradient>
						<filter id={`radar-glow-${color.replace("#", "")}`}>
							<feGaussianBlur in="SourceGraphic" stdDeviation="2" />
							<feComponentTransfer>
								<feFuncA slope="1.5" type="linear" />
							</feComponentTransfer>
							<feMerge>
								<feMergeNode />
								<feMergeNode in="SourceGraphic" />
							</feMerge>
						</filter>
					</defs>
					<PolarGrid stroke="rgb(63 63 70 / 0.3)" />
					<PolarAngleAxis
						dataKey="axis"
						fontSize={10}
						tick={{ fill: "#a1a1aa" }}
					/>
					<Radar
						animationDuration={1000}
						animationEasing="ease-out"
						dataKey="value"
						dot={{
							fill: color,
							r: 3,
							strokeWidth: 2,
							stroke: "#18181b",
						}}
						fill={`url(#${gradientId})`}
						fillOpacity={1}
						stroke={color}
						strokeWidth={2.5}
						style={{
							filter: `url(#radar-glow-${color.replace("#", "")})`,
						}}
					/>
					<Tooltip {...TOOLTIP_STYLE_GLASS} />
				</RadarChart>
			</ResponsiveContainer>
		</div>
	);
}
