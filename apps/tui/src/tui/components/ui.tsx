// @ts-nocheck
import type { TextChunk } from "@opentui/core";
import { dim, StyledText, t } from "@opentui/core";
import { COLORS, SEMANTIC } from "../theme";

/**
 * Breadcrumbs компонент для навигации
 */
export function Breadcrumbs({
	items,
}: {
	items: Array<{ label: string; active?: boolean }>;
}) {
	const chunks: TextChunk[] = [];

	for (let i = 0; i < items.length; i++) {
		if (i > 0) {
			chunks.push(dim(" › "));
		}

		const item = items[i];
		if (item.active) {
			chunks.push(t`${SEMANTIC.primary}${item.label}${COLORS.reset}`);
		} else {
			chunks.push(dim(item.label));
		}
	}

	return (
		<box flexDirection="row" paddingBottom={1}>
			<text content={new StyledText(chunks)} height={1} />
		</box>
	);
}

/**
 * StatusIndicator компонент
 */
export function StatusIndicator({
	status,
	label,
}: {
	status: "connected" | "disconnected" | "loading" | "exists" | "missing";
	label?: string;
}) {
	const statusConfig = {
		connected: { icon: "●", color: SEMANTIC.success },
		disconnected: { icon: "○", color: COLORS.zinc600 },
		loading: { icon: "◐", color: SEMANTIC.warning },
		exists: { icon: "✓", color: SEMANTIC.success },
		missing: { icon: "✗", color: SEMANTIC.error },
	};

	const { icon, color } = statusConfig[status];
	const text = label ? `${icon} ${label}` : icon;

	return <text content={t`${color}${text}${COLORS.reset}`} height={1} />;
}

/**
 * Utility функция для создания StyledText
 */
function s(...chunks: TextChunk[]): StyledText {
	return new StyledText(chunks);
}

/**
 * Section компонент для отображения блоков с заголовком
 */
export function Section({
	label,
	text,
	color = SEMANTIC.primary,
}: {
	label: string;
	text: string;
	color?: string;
}) {
	if (!text) {
		return null;
	}

	return (
		<box flexDirection="column" paddingTop={1}>
			<text content={s(t`${color}${label}${COLORS.reset}`)} height={1} />
			<text content={text} />
		</box>
	);
}

/**
 * Badge компонент
 */
export function Badge({
	text,
	variant = "muted",
}: {
	text: string;
	variant?: "primary" | "success" | "warning" | "error" | "muted";
}) {
	const colorMap = {
		primary: SEMANTIC.primary,
		success: SEMANTIC.success,
		warning: SEMANTIC.warning,
		error: SEMANTIC.error,
		muted: SEMANTIC.muted,
	};

	const color = colorMap[variant];
	const content = `[${text}]`;

	return <text content={t`${color}${content}${COLORS.reset}`} height={1} />;
}

/**
 * Divider компонент
 */
export function Divider({ width = 60 }: { width?: number }) {
	const line = "─".repeat(width);
	return (
		<text content={t`${SEMANTIC.divider}${line}${COLORS.reset}`} height={1} />
	);
}

/**
 * EmptyState компонент
 */
export function EmptyState({
	icon = "○",
	title,
	description,
	action,
}: {
	icon?: string;
	title: string;
	description?: string;
	action?: string;
}) {
	return (
		<box
			alignItems="center"
			flexDirection="column"
			flexGrow={1}
			gap={1}
			justifyContent="center"
		>
			<text content={t`${SEMANTIC.muted}${icon}${COLORS.reset}`} height={1} />
			<text content={t`${SEMANTIC.text}${title}${COLORS.reset}`} height={1} />
			{description && (
				<text
					content={t`${SEMANTIC.muted}${description}${COLORS.reset}`}
					height={1}
				/>
			)}
			{action && (
				<text
					content={t`${SEMANTIC.subtle}${action}${COLORS.reset}`}
					height={1}
				/>
			)}
		</box>
	);
}

/**
 * Table компонент для отображения табличных данных
 */
export function Table({
	headers,
	rows,
	columnWidths,
}: {
	headers: string[];
	rows: string[][];
	columnWidths?: number[];
}) {
	const widths = columnWidths ?? headers.map(() => 15);

	// Header
	const headerText = headers
		.map((h, i) => padOrTruncate(h, widths[i]))
		.join(" ");

	// Divider
	const dividerText = widths.map((w) => "─".repeat(w)).join(" ");

	// Rows
	const rowsText = rows
		.map((row) =>
			row.map((cell, i) => padOrTruncate(cell, widths[i])).join(" ")
		)
		.join("\n");

	return (
		<box flexDirection="column" gap={0}>
			<text
				content={t`${COLORS.bold}${SEMANTIC.text}${headerText}${COLORS.reset}`}
				height={1}
			/>
			<text
				content={t`${SEMANTIC.divider}${dividerText}${COLORS.reset}`}
				height={1}
			/>
			<text content={rowsText} />
		</box>
	);
}

/**
 * Utility для выравнивания текста
 */
function padOrTruncate(text: string, width: number): string {
	if (text.length > width) {
		return text.slice(0, width - 1) + "…";
	}
	return text.padEnd(width);
}

/**
 * ProgressBar компонент
 */
export function ProgressBar({
	value,
	max = 100,
	width = 20,
	showPercentage = true,
}: {
	value: number;
	max?: number;
	width?: number;
	showPercentage?: boolean;
}) {
	const percentage = Math.min(100, Math.max(0, (value / max) * 100));
	const filled = Math.round((percentage / 100) * width);
	const empty = width - filled;

	// Цвет на основе процента
	let color = COLORS.red;
	if (percentage >= 70) {
		color = SEMANTIC.success;
	} else if (percentage >= 40) {
		color = SEMANTIC.warning;
	}

	const bar = "█".repeat(filled) + "░".repeat(empty);
	const percentText = showPercentage ? ` ${Math.round(percentage)}%` : "";

	return (
		<text
			content={t`${color}${bar}${COLORS.reset}${SEMANTIC.muted}${percentText}${COLORS.reset}`}
			height={1}
		/>
	);
}

/**
 * KeyHint компонент для отображения клавиатурных подсказок
 */
export function KeyHint({
	keys,
}: {
	keys: Array<{ key: string; label: string }>;
}) {
	const hints = keys
		.map(
			({ key, label }) =>
				`${SEMANTIC.muted}${key}${COLORS.reset} ${COLORS.dim}${label}${COLORS.reset}`
		)
		.join(`${COLORS.dim} · ${COLORS.reset}`);

	return <text content={new StyledText([t`${hints}`])} height={1} />;
}

/**
 * Card компонент с border
 */
export function Card({
	title,
	children,
	width = 60,
}: {
	title?: string;
	children: React.ReactNode;
	width?: number;
}) {
	const topBorder = title
		? `┌─ ${title} ${"─".repeat(Math.max(0, width - title.length - 4))}┐`
		: `┌${"─".repeat(width - 2)}┐`;
	const bottomBorder = `└${"─".repeat(width - 2)}┘`;

	return (
		<box flexDirection="column" gap={0}>
			<text
				content={t`${SEMANTIC.border}${topBorder}${COLORS.reset}`}
				height={1}
			/>
			<box flexDirection="column" paddingX={2} paddingY={1}>
				{children}
			</box>
			<text
				content={t`${SEMANTIC.border}${bottomBorder}${COLORS.reset}`}
				height={1}
			/>
		</box>
	);
}

/**
 * Spinner компонент для загрузки
 */
export function Spinner({ text = "Loading..." }: { text?: string }) {
	const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
	const [frame, setFrame] = React.useState(0);

	React.useEffect(() => {
		const timer = setInterval(() => {
			setFrame((f) => (f + 1) % frames.length);
		}, 80);
		return () => clearInterval(timer);
	}, []);

	return (
		<text
			content={t`${SEMANTIC.primary}${frames[frame]}${COLORS.reset} ${SEMANTIC.muted}${text}${COLORS.reset}`}
			height={1}
		/>
	);
}

/**
 * List компонент для отображения списков
 */
export function List({
	items,
	selectedIndex,
	icon = "•",
}: {
	items: Array<{ label: string; subtitle?: string; badge?: string }>;
	selectedIndex?: number;
	icon?: string;
}) {
	return (
		<box flexDirection="column" gap={0}>
			{items.map((item, i) => {
				const isSelected = i === selectedIndex;
				const itemIcon = isSelected ? "›" : icon;
				const iconColor = isSelected ? SEMANTIC.primary : SEMANTIC.muted;
				const textColor = isSelected ? SEMANTIC.text : SEMANTIC.muted;

				return (
					<box flexDirection="column" key={i} paddingY={0}>
						<box flexDirection="row" gap={1}>
							<text
								content={t`${iconColor}${itemIcon}${COLORS.reset}`}
								height={1}
								width={2}
							/>
							<text
								content={t`${textColor}${item.label}${COLORS.reset}`}
								height={1}
							/>
							{item.badge && (
								<text
									content={t`${SEMANTIC.muted}[${item.badge}]${COLORS.reset}`}
									height={1}
								/>
							)}
						</box>
						{item.subtitle && (
							<box flexDirection="row" paddingLeft={3}>
								<text
									content={t`${SEMANTIC.subtle}${item.subtitle}${COLORS.reset}`}
									height={1}
								/>
							</box>
						)}
					</box>
				);
			})}
		</box>
	);
}
