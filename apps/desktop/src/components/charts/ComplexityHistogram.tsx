import { useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { CHART_COLORS, TOOLTIP_STYLE_GLASS } from "./theme";

interface ComplexityHistogramProps {
	className?: string;
	data: Array<{ range: string; count: number }>;
	height?: number;
}

const BAR_COLORS: Record<string, string> = {
	"1-5": CHART_COLORS.emerald,
	"6-10": CHART_COLORS.blue,
	"11-20": CHART_COLORS.amber,
	"21+": CHART_COLORS.red,
};

export default function ComplexityHistogram({
	data,
	height = 200,
	className,
}: ComplexityHistogramProps) {
	const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

	return (
		<div className={className} style={{ height }}>
			<ResponsiveContainer height="100%" width="100%">
				<BarChart
					data={data}
					margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
					onMouseLeave={() => setActiveIndex(undefined)}
					onMouseMove={(state) => {
						if (state.isTooltipActive) {
							if (typeof state.activeTooltipIndex === "number") {
								setActiveIndex(state.activeTooltipIndex);
							}
						} else {
							setActiveIndex(undefined);
						}
					}}
				>
					<defs>
						{/* Gradient definitions for each bar color */}
						{Object.entries(BAR_COLORS).map(([range, color]) => {
							const gradientId = `gradient-complexity-${range}`;
							const r = Number.parseInt(color.slice(1, 3), 16);
							const g = Number.parseInt(color.slice(3, 5), 16);
							const b = Number.parseInt(color.slice(5, 7), 16);
							const lighterColor = `rgb(${Math.min(r + 30, 255)}, ${Math.min(g + 30, 255)}, ${Math.min(b + 30, 255)})`;

							return (
								<linearGradient
									id={gradientId}
									key={gradientId}
									x1="0"
									x2="0"
									y1="0"
									y2="1"
								>
									<stop
										offset="0%"
										stopColor={lighterColor}
										stopOpacity={0.9}
									/>
									<stop offset="100%" stopColor={color} stopOpacity={1} />
								</linearGradient>
							);
						})}
					</defs>
					<CartesianGrid
						stroke="rgb(63 63 70 / 0.2)"
						strokeDasharray="3 3"
						vertical={false}
					/>
					<XAxis
						axisLine={false}
						dataKey="range"
						fontSize={11}
						stroke="#52525b"
						tick={{ fill: "#a1a1aa" }}
						tickLine={false}
					/>
					<YAxis
						axisLine={false}
						fontSize={10}
						stroke="#52525b"
						tick={{ fill: "#71717a" }}
						tickLine={false}
						width={40}
					/>
					<Tooltip
						{...TOOLTIP_STYLE_GLASS}
						cursor={{ fill: "rgb(99 102 241 / 0.1)" }}
					/>
					<Bar
						animationBegin={100}
						animationDuration={1000}
						animationEasing="ease-out"
						barSize={40}
						dataKey="count"
						name="Symbols"
						radius={[6, 6, 0, 0]}
					>
						{data.map((entry, index) => {
							const baseColor = BAR_COLORS[entry.range] ?? CHART_COLORS.indigo;
							const gradientId = `gradient-complexity-${entry.range}`;

							return (
								<Cell
									fill={`url(#${gradientId})`}
									key={entry.range}
									style={{
										filter:
											activeIndex === index
												? `brightness(1.2) drop-shadow(0 4px 12px ${baseColor}66)`
												: "brightness(1)",
										transition: "all 0.3s ease",
										transformOrigin: "bottom",
									}}
								/>
							);
						})}
					</Bar>
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}
