import { ResponsiveContainer, Treemap } from "recharts";
import { PALETTE } from "./theme";

interface FileTreemapProps {
	className?: string;
	data: Array<{ name: string; size: number }>;
	height?: number;
	onClick?: (name: string) => void;
}

interface TreemapContentProps {
	height: number;
	index: number;
	name: string;
	onClick?: (name: string) => void;
	size: number;
	width: number;
	x: number;
	y: number;
}

function TreemapContent({
	x,
	y,
	width,
	height,
	name,
	index,
	size,
	onClick,
}: TreemapContentProps) {
	const showLabel = width > 50 && height > 24;
	const showCount = width > 60 && height > 38;
	const color = PALETTE[index % PALETTE.length];

	return (
		<g
			cursor={onClick ? "pointer" : undefined}
			onClick={() => onClick?.(name)}
			onKeyDown={(e) => {
				if (e.key === "Enter") {
					onClick?.(name);
				}
			}}
			role={onClick ? "button" : undefined}
			tabIndex={onClick ? 0 : undefined}
		>
			<rect
				fill={color}
				fillOpacity={0.15}
				height={height}
				rx={4}
				stroke={color}
				strokeOpacity={0.3}
				strokeWidth={1}
				width={width}
				x={x}
				y={y}
			/>
			{showLabel && (
				<text
					dominantBaseline="hanging"
					fill="#d4d4d8"
					fontFamily="ui-monospace, monospace"
					fontSize={10}
					x={x + 6}
					y={y + 6}
				>
					{name.length > Math.floor(width / 6)
						? `${name.slice(0, Math.floor(width / 6) - 2)}...`
						: name}
				</text>
			)}
			{showCount && (
				<text
					dominantBaseline="hanging"
					fill="#71717a"
					fontSize={9}
					x={x + 6}
					y={y + 20}
				>
					{size}
				</text>
			)}
		</g>
	);
}

export default function FileTreemap({
	data,
	height = 280,
	className,
	onClick,
}: FileTreemapProps) {
	const treemapData = data.map((d) => ({
		name: d.name.split("/").pop() ?? d.name,
		fullPath: d.name,
		size: d.size,
	}));

	return (
		<div className={className} style={{ height }}>
			<ResponsiveContainer height="100%" width="100%">
				<Treemap
					animationDuration={400}
					content={
						<TreemapContent
							height={0}
							index={0}
							name=""
							onClick={(name) => {
								const item = treemapData.find((d) => d.name === name);
								onClick?.(item?.fullPath ?? name);
							}}
							size={0}
							width={0}
							x={0}
							y={0}
						/>
					}
					data={treemapData}
					dataKey="size"
					nameKey="name"
					stroke="none"
				/>
			</ResponsiveContainer>
		</div>
	);
}
