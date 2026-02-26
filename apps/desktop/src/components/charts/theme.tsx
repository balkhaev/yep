export const CHART_COLORS = {
	// Flat colors (основные)
	indigo: "#6366f1",
	blue: "#3b82f6",
	emerald: "#10b981",
	amber: "#f59e0b",
	pink: "#ec4899",
	purple: "#a855f7",
	cyan: "#06b6d4",
	orange: "#f97316",
	red: "#ef4444",
	lime: "#84cc16",

	// Gradient versions (для более современного вида)
	indigoGradient: ["#6366f1", "#8b5cf6"],
	blueGradient: ["#3b82f6", "#6366f1"],
	emeraldGradient: ["#10b981", "#14b8a6"],
	amberGradient: ["#f59e0b", "#fbbf24"],
	pinkGradient: ["#ec4899", "#f472b6"],
	purpleGradient: ["#a855f7", "#c084fc"],
	cyanGradient: ["#06b6d4", "#22d3ee"],
	orangeGradient: ["#f97316", "#fb923c"],
	redGradient: ["#ef4444", "#f87171"],
	limeGradient: ["#84cc16", "#a3e635"],
} as const;

/**
 * Semantic colors для различных контекстов
 */
export const SEMANTIC_COLORS = {
	success: {
		base: CHART_COLORS.emerald,
		gradient: CHART_COLORS.emeraldGradient,
	},
	warning: {
		base: CHART_COLORS.amber,
		gradient: CHART_COLORS.amberGradient,
	},
	error: {
		base: CHART_COLORS.red,
		gradient: CHART_COLORS.redGradient,
	},
	info: {
		base: CHART_COLORS.blue,
		gradient: CHART_COLORS.blueGradient,
	},
	primary: {
		base: CHART_COLORS.indigo,
		gradient: CHART_COLORS.indigoGradient,
	},
} as const;

export const PALETTE = [
	CHART_COLORS.indigo,
	CHART_COLORS.emerald,
	CHART_COLORS.amber,
	CHART_COLORS.pink,
	CHART_COLORS.blue,
	CHART_COLORS.purple,
	CHART_COLORS.cyan,
	CHART_COLORS.orange,
	CHART_COLORS.red,
	CHART_COLORS.lime,
];

export const TYPE_CHART_COLORS: Record<string, string> = {
	function: CHART_COLORS.blue,
	class: CHART_COLORS.purple,
	component: CHART_COLORS.emerald,
	interface: CHART_COLORS.amber,
	type: CHART_COLORS.pink,
};

export const SEVERITY_COLORS: Record<string, string> = {
	critical: CHART_COLORS.red,
	warning: CHART_COLORS.amber,
	info: CHART_COLORS.blue,
};

export const LANG_CHART_COLORS: Record<string, string> = {
	typescript: CHART_COLORS.blue,
	javascript: CHART_COLORS.amber,
	python: CHART_COLORS.emerald,
	go: CHART_COLORS.cyan,
	rust: CHART_COLORS.orange,
};

/**
 * Enhanced tooltip style с glassmorphism эффектом
 */
export const TOOLTIP_STYLE = {
	contentStyle: {
		background: "rgba(24, 24, 27, 0.92)",
		border: "1px solid rgba(63, 63, 70, 0.5)",
		borderRadius: "12px",
		padding: "10px 14px",
		fontSize: "12px",
		color: "#e4e4e7",
		backdropFilter: "blur(12px)",
		WebkitBackdropFilter: "blur(12px)",
		boxShadow:
			"0 8px 32px rgb(0 0 0 / 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
	},
	itemStyle: {
		color: "#a1a1aa",
		fontSize: "11px",
		padding: "3px 0",
	},
	labelStyle: {
		color: "#f4f4f5",
		fontWeight: 600,
		marginBottom: "6px",
		fontSize: "13px",
	},
} as const;

/**
 * Enhanced glassmorphism tooltip для интерактивных графиков
 */
export const TOOLTIP_STYLE_GLASS = {
	contentStyle: {
		background: "rgba(24, 24, 27, 0.85)",
		border: "1px solid rgba(99, 102, 241, 0.3)",
		borderRadius: "14px",
		padding: "12px 16px",
		fontSize: "12px",
		color: "#e4e4e7",
		backdropFilter: "blur(16px) saturate(180%)",
		WebkitBackdropFilter: "blur(16px) saturate(180%)",
		boxShadow:
			"0 8px 32px rgba(99, 102, 241, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.08) inset",
	},
	itemStyle: {
		color: "#a1a1aa",
		fontSize: "11px",
		padding: "3px 0",
	},
	labelStyle: {
		color: "#f4f4f5",
		fontWeight: 600,
		marginBottom: "6px",
		fontSize: "13px",
	},
} as const;

/**
 * Utility function для создания линейного градиента для Recharts
 */
export function createLinearGradient(
	id: string,
	colors: readonly [string, string],
	vertical = true
): React.ReactElement {
	return (
		<linearGradient
			id={id}
			x1={vertical ? "0" : "0%"}
			x2={vertical ? "0" : "100%"}
			y1={vertical ? "0" : "0%"}
			y2={vertical ? "100%" : "0%"}
		>
			<stop offset="0%" stopColor={colors[0]} stopOpacity={1} />
			<stop offset="100%" stopColor={colors[1]} stopOpacity={1} />
		</linearGradient>
	);
}

/**
 * Utility function для создания radial градиента
 */
export function createRadialGradient(
	id: string,
	colors: readonly [string, string]
): React.ReactElement {
	return (
		<radialGradient id={id}>
			<stop offset="0%" stopColor={colors[0]} stopOpacity={1} />
			<stop offset="100%" stopColor={colors[1]} stopOpacity={0.4} />
		</radialGradient>
	);
}
