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

interface BarDatum {
	color?: string;
	name: string;
	value: number;
	value2?: number;
	value3?: number;
}

interface HorizontalBarChartProps {
	barKeys?: Array<{ key: string; color: string; label?: string }>;
	className?: string;
	data: BarDatum[];
	height?: number;
	onClick?: (name: string) => void;
	stacked?: boolean;
}

export default function HorizontalBarChart({
	data,
	height,
	stacked = false,
	barKeys,
	className,
	onClick,
}: HorizontalBarChartProps) {
	const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

	const keys = barKeys ?? [
		{ key: "value", color: CHART_COLORS.indigo, label: "Value" },
	];

	const chartHeight = height ?? Math.max(data.length * 36, 120);

	return (
		<div className={className} style={{ height: chartHeight }}>
			<ResponsiveContainer height="100%" width="100%">
				<BarChart
					data={data}
					layout="vertical"
					margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
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
						{/* Gradient definitions for each bar key */}
						{keys.map((k) => {
							const gradientId = `gradient-bar-${k.key}`;
							const baseColor = k.color;

							// Convert hex to RGB for gradient
							const r = Number.parseInt(baseColor.slice(1, 3), 16);
							const g = Number.parseInt(baseColor.slice(3, 5), 16);
							const b = Number.parseInt(baseColor.slice(5, 7), 16);

							const lighterColor = `rgb(${Math.min(r + 40, 255)}, ${Math.min(g + 40, 255)}, ${Math.min(b + 40, 255)})`;

							return (
								<linearGradient
									id={gradientId}
									key={gradientId}
									x1="0"
									x2="1"
									y1="0"
									y2="0"
								>
									<stop offset="0%" stopColor={baseColor} stopOpacity={0.9} />
									<stop
										offset="100%"
										stopColor={lighterColor}
										stopOpacity={1}
									/>
								</linearGradient>
							);
						})}
					</defs>
					<CartesianGrid
						horizontal={false}
						stroke="rgb(63 63 70 / 0.2)"
						strokeDasharray="3 3"
					/>
					<XAxis
						axisLine={false}
						fontSize={10}
						stroke="#52525b"
						tick={{ fill: "#71717a" }}
						tickLine={false}
						type="number"
					/>
					<YAxis
						axisLine={false}
						dataKey="name"
						fontSize={11}
						stroke="#52525b"
						tick={{ fill: "#a1a1aa" }}
						tickLine={false}
						type="category"
						width={120}
					/>
					<Tooltip
						{...TOOLTIP_STYLE_GLASS}
						cursor={{ fill: "rgb(99 102 241 / 0.1)" }}
					/>
					{keys.map((k) => (
						<Bar
							animationDuration={800}
							animationEasing="ease-out"
							barSize={16}
							cursor={onClick ? "pointer" : undefined}
							dataKey={k.key}
							fill={`url(#gradient-bar-${k.key})`}
							key={k.key}
							name={k.label ?? k.key}
							onClick={(entry) => onClick?.(String(entry.name ?? ""))}
							radius={[0, 4, 4, 0]}
							stackId={stacked ? "stack" : undefined}
						>
							{data.map((_, index) => (
								<Cell
									fill={`url(#gradient-bar-${k.key})`}
									key={`cell-${index}`}
									style={{
										filter:
											activeIndex === index
												? "brightness(1.2) drop-shadow(0 0 8px rgba(99, 102, 241, 0.4))"
												: "brightness(1)",
										transition: "all 0.3s ease",
									}}
								/>
							))}
						</Bar>
					))}
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}
