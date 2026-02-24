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
import { CHART_COLORS, TOOLTIP_STYLE } from "./theme";

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
	return (
		<div className={className} style={{ height }}>
			<ResponsiveContainer height="100%" width="100%">
				<BarChart
					data={data}
					margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
				>
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
						{...TOOLTIP_STYLE}
						cursor={{ fill: "rgb(63 63 70 / 0.15)" }}
					/>
					<Bar
						animationDuration={600}
						barSize={32}
						dataKey="count"
						name="Symbols"
						radius={[4, 4, 0, 0]}
					>
						{data.map((entry) => (
							<Cell
								fill={BAR_COLORS[entry.range] ?? CHART_COLORS.indigo}
								key={entry.range}
							/>
						))}
					</Bar>
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}
