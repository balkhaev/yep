import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { CHART_COLORS, TOOLTIP_STYLE } from "./theme";

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
				>
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
						{...TOOLTIP_STYLE}
						cursor={{ fill: "rgb(63 63 70 / 0.15)" }}
					/>
					{keys.map((k) => (
						<Bar
							animationDuration={600}
							barSize={16}
							cursor={onClick ? "pointer" : undefined}
							dataKey={k.key}
							fill={k.color}
							key={k.key}
							name={k.label ?? k.key}
							onClick={(entry) => onClick?.(String(entry.name ?? ""))}
							radius={[0, 4, 4, 0]}
							stackId={stacked ? "stack" : undefined}
						/>
					))}
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}
