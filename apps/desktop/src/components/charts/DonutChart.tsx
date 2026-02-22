import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PALETTE, TOOLTIP_STYLE } from "./theme";

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

export default function DonutChart({
	data,
	size = 200,
	innerLabel,
	innerValue,
	colors = PALETTE,
	className,
}: DonutChartProps) {
	return (
		<div className={className} style={{ width: size, height: size }}>
			<ResponsiveContainer>
				<PieChart>
					<Pie
						animationBegin={0}
						animationDuration={600}
						cx="50%"
						cy="50%"
						data={data}
						dataKey="value"
						innerRadius="62%"
						nameKey="name"
						outerRadius="85%"
						paddingAngle={2}
						strokeWidth={0}
					>
						{data.map((entry, i) => (
							<Cell
								fill={entry.color ?? colors[i % colors.length]}
								key={entry.name}
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
						{...TOOLTIP_STYLE}
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
