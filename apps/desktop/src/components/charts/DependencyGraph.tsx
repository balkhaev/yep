import { useRef } from "react";
import type { CodeResult } from "@/api";
import { CHART_COLORS } from "./theme";

interface DependencyGraphProps {
	callees: CodeResult[];
	callers: CodeResult[];
	center: { symbol: string; symbolType: string };
	className?: string;
	importers: CodeResult[];
	onSelect?: (symbol: string) => void;
	size?: number;
}

interface NodeData {
	relation: "center" | "caller" | "callee" | "importer";
	symbol: string;
	type: string;
	x: number;
	y: number;
}

const RELATION_COLORS: Record<string, string> = {
	center: CHART_COLORS.indigo,
	caller: CHART_COLORS.emerald,
	callee: CHART_COLORS.blue,
	importer: CHART_COLORS.amber,
};

function layoutNodes(
	center: { symbol: string; symbolType: string },
	callers: CodeResult[],
	callees: CodeResult[],
	importers: CodeResult[],
	size: number
): NodeData[] {
	const cx = size / 2;
	const cy = size / 2;
	const nodes: NodeData[] = [
		{
			symbol: center.symbol,
			type: center.symbolType,
			relation: "center",
			x: cx,
			y: cy,
		},
	];

	const groups = [
		{
			items: callers.slice(0, 6),
			relation: "caller" as const,
			startAngle: -Math.PI / 2 - Math.PI / 3,
		},
		{
			items: callees.slice(0, 6),
			relation: "callee" as const,
			startAngle: Math.PI / 6,
		},
		{
			items: importers.slice(0, 6),
			relation: "importer" as const,
			startAngle: Math.PI / 2 + Math.PI / 6,
		},
	];

	const radius = size * 0.35;

	for (const group of groups) {
		const count = group.items.length;
		if (count === 0) {
			continue;
		}
		const arcSpan = (Math.PI * 2) / 3;
		const step = count > 1 ? arcSpan / (count - 1) : 0;
		const offset = count > 1 ? 0 : arcSpan / 2;

		for (let i = 0; i < count; i++) {
			const angle = group.startAngle + offset + step * i;
			nodes.push({
				symbol: group.items[i].symbol,
				type: group.items[i].symbolType,
				relation: group.relation,
				x: cx + Math.cos(angle) * radius,
				y: cy + Math.sin(angle) * radius,
			});
		}
	}

	return nodes;
}

export default function DependencyGraph({
	center,
	callers,
	callees,
	importers,
	size = 320,
	onSelect,
	className,
}: DependencyGraphProps) {
	const svgRef = useRef<SVGSVGElement>(null);
	const nodes = layoutNodes(center, callers, callees, importers, size);
	const centerNode = nodes[0];
	const outerNodes = nodes.slice(1);

	const totalConnections = callers.length + callees.length + importers.length;
	if (totalConnections === 0) {
		return (
			<div
				className={`flex items-center justify-center text-xs text-zinc-600 ${className ?? ""}`}
				style={{ height: size }}
			>
				No connections
			</div>
		);
	}

	return (
		<div className={className}>
			<svg
				aria-hidden="true"
				height={size}
				ref={svgRef}
				style={{ maxHeight: size }}
				viewBox={`0 0 ${size} ${size}`}
				width="100%"
			>
				{outerNodes.map((node) => (
					<line
						key={`edge-${node.symbol}-${node.relation}`}
						stroke={RELATION_COLORS[node.relation]}
						strokeOpacity={0.25}
						strokeWidth={1.5}
						x1={centerNode.x}
						x2={node.x}
						y1={centerNode.y}
						y2={node.y}
					/>
				))}

				{outerNodes.map((node) => (
					<g
						cursor={onSelect ? "pointer" : undefined}
						key={`node-${node.symbol}-${node.relation}`}
						onClick={() => onSelect?.(node.symbol)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								onSelect?.(node.symbol);
							}
						}}
						role={onSelect ? "button" : undefined}
						tabIndex={onSelect ? 0 : undefined}
					>
						<circle
							cx={node.x}
							cy={node.y}
							fill={RELATION_COLORS[node.relation]}
							fillOpacity={0.1}
							r={18}
							stroke={RELATION_COLORS[node.relation]}
							strokeOpacity={0.4}
							strokeWidth={1.5}
						/>
						<text
							dominantBaseline="central"
							fill="#d4d4d8"
							fontFamily="ui-monospace, monospace"
							fontSize={8}
							textAnchor="middle"
							x={node.x}
							y={node.y}
						>
							{node.symbol.length > 10
								? `${node.symbol.slice(0, 9)}…`
								: node.symbol}
						</text>
					</g>
				))}

				<circle
					cx={centerNode.x}
					cy={centerNode.y}
					fill={RELATION_COLORS.center}
					fillOpacity={0.15}
					r={26}
					stroke={RELATION_COLORS.center}
					strokeWidth={2}
				/>
				<text
					dominantBaseline="central"
					fill="#e4e4e7"
					fontFamily="ui-monospace, monospace"
					fontSize={10}
					fontWeight={600}
					textAnchor="middle"
					x={centerNode.x}
					y={centerNode.y}
				>
					{center.symbol.length > 12
						? `${center.symbol.slice(0, 11)}…`
						: center.symbol}
				</text>
			</svg>

			<div className="mt-2 flex justify-center gap-4">
				{callers.length > 0 && (
					<span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
						<span
							className="h-2 w-2 rounded-full"
							style={{ background: RELATION_COLORS.caller }}
						/>
						{callers.length} callers
					</span>
				)}
				{callees.length > 0 && (
					<span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
						<span
							className="h-2 w-2 rounded-full"
							style={{ background: RELATION_COLORS.callee }}
						/>
						{callees.length} callees
					</span>
				)}
				{importers.length > 0 && (
					<span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
						<span
							className="h-2 w-2 rounded-full"
							style={{ background: RELATION_COLORS.importer }}
						/>
						{importers.length} importers
					</span>
				)}
			</div>
		</div>
	);
}
