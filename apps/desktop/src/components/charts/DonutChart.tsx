import { useState } from "react";
import {
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Sector,
	Tooltip,
} from "recharts";
import { PALETTE, TOOLTIP_STYLE_GLASS } from "./theme";

interface DonutChartProps {
	className?: string;
	colors?: string[];
	data: Array<{ name: string; value: number; color?: string }>;
	innerLabel?: string;
	innerValue?: string | number;
	size?: number;
}

function CenterLabel({
	cx,
	cy,
	label,
	value,
}: {
	cx: number;
	cy: number;
	label?: string;
	value?: string | number;
}) {
	return (
		<g>
			{value !== undefined && (
				<text
					dominantBaseline="central"
					fill="#e4e4e7"
					fontSize="20"
					fontWeight="700"
					textAnchor="middle"
					x={cx}
					y={label ? cy - 8 : cy}
				>
					{value}
				</text>
			)}
			{label && (
				<text
					dominantBaseline="central"
					fill="#71717a"
					fontSize="10"
					textAnchor="middle"
					x={cx}
					y={value !== undefined ? cy + 12 : cy}
				>
					{label}
				</text>
			)}
		</g>
	);
}

// Active shape with glow effect
function ActiveShape(props: any) {
	const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } =
		props;

	return (
		<g>
			<defs>
				<filter id={`glow-${fill}`}>
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
			<Sector
				cx={cx}
				cy={cy}
				endAngle={endAngle}
				fill={fill}
				filter={`url(#glow-${fill})`}
				innerRadius={innerRadius}
				opacity={1}
				outerRadius={outerRadius + 8}
				startAngle={startAngle}
			/>
		</g>
	);
}

export default function DonutChart({
	data,
	size = 200,
	innerLabel,
	innerValue,
	colors = PALETTE,
	className,
}: DonutChartProps) {
	const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

	return (
		<div className={className} style={{ width: size, height: size }}>
			<ResponsiveContainer>
				<PieChart>
					<defs>
						{/* Gradient definitions */}
						{data.map((entry, i) => {
							const baseColor = entry.color ?? colors[i % colors.length];
							const gradientId = `gradient-donut-${i}`;

							// Convert hex to RGB for gradient
							const r = Number.parseInt(baseColor.slice(1, 3), 16);
							const g = Number.parseInt(baseColor.slice(3, 5), 16);
							const b = Number.parseInt(baseColor.slice(5, 7), 16);

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
									<stop offset="100%" stopColor={baseColor} stopOpacity={1} />
								</linearGradient>
							);
						})}
					</defs>
					<Pie
						activeShape={activeIndex !== undefined ? ActiveShape : undefined}
						animationBegin={0}
						animationDuration={800}
						animationEasing="ease-out"
						cx="50%"
						cy="50%"
						data={data}
						dataKey="value"
						innerRadius="62%"
						nameKey="name"
						onMouseEnter={(_, index) => setActiveIndex(index)}
						onMouseLeave={() => setActiveIndex(undefined)}
						outerRadius="85%"
						paddingAngle={2}
						strokeWidth={0}
					>
						{data.map((entry, i) => (
							<Cell
								fill={`url(#gradient-donut-${i})`}
								key={entry.name}
								style={{
									transition: "all 0.3s ease",
									cursor: "pointer",
								}}
							/>
						))}
					</Pie>
					{(innerLabel || innerValue !== undefined) && (
						<Pie
							animationDuration={0}
							cx="50%"
							cy="50%"
							data={[{ value: 1 }]}
							dataKey="value"
							fill="none"
							innerRadius={0}
							isAnimationActive={false}
							label={({ cx, cy }) => (
								<CenterLabel
									cx={cx}
									cy={cy}
									label={innerLabel}
									value={innerValue}
								/>
							)}
							labelLine={false}
							outerRadius={0}
							stroke="none"
						/>
					)}
					<Tooltip
						{...TOOLTIP_STYLE_GLASS}
						formatter={(val, name) => {
							const v = Number(val) || 0;
							const total = data.reduce((s, d) => s + d.value, 0);
							const pct = total > 0 ? Math.round((v / total) * 100) : 0;
							return [`${v} (${pct}%)`, String(name)];
						}}
					/>
				</PieChart>
			</ResponsiveContainer>
		</div>
	);
}
