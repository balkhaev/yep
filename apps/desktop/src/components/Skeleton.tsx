interface SkeletonProps {
	className?: string;
	height?: string | number;
	variant?: "text" | "circular" | "rectangular";
	width?: string | number;
}

export function Skeleton({
	className = "",
	variant = "rectangular",
	width,
	height,
}: SkeletonProps) {
	const baseClasses =
		"animate-pulse bg-gradient-to-r from-zinc-800/50 to-zinc-700/50";
	const variantClasses = {
		text: "rounded-md h-4",
		circular: "rounded-full",
		rectangular: "rounded-xl",
	};

	const style = {
		width: typeof width === "number" ? `${width}px` : width,
		height: typeof height === "number" ? `${height}px` : height,
	};

	return (
		<div
			className={`${baseClasses} ${variantClasses[variant]} ${className}`}
			style={style}
		/>
	);
}

export function SkeletonCard() {
	return (
		<div className="card space-y-4 p-6">
			<div className="space-y-2">
				<Skeleton height={20} width="40%" />
				<Skeleton height={14} width="60%" />
			</div>
			<div className="space-y-2">
				<Skeleton height={80} />
				<div className="flex gap-2">
					<Skeleton className="flex-1" height={40} />
					<Skeleton className="flex-1" height={40} />
				</div>
			</div>
		</div>
	);
}

export function SkeletonChart() {
	return (
		<div className="card space-y-4 p-6">
			<div className="space-y-2">
				<Skeleton height={16} width="35%" />
				<Skeleton height={12} width="55%" />
			</div>
			<Skeleton height={200} />
		</div>
	);
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
	return (
		<div className="space-y-2">
			{Array.from({ length: lines }).map((_, i) => (
				<Skeleton
					height={14}
					key={i}
					width={i === lines - 1 ? "70%" : "100%"}
				/>
			))}
		</div>
	);
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
	return (
		<div className="space-y-2">
			<div className="flex gap-4 border-zinc-800 border-b pb-2">
				<Skeleton height={14} width="25%" />
				<Skeleton height={14} width="20%" />
				<Skeleton height={14} width="20%" />
				<Skeleton height={14} width="15%" />
			</div>
			{Array.from({ length: rows }).map((_, i) => (
				<div className="flex gap-4 py-2" key={i}>
					<Skeleton height={16} width="25%" />
					<Skeleton height={16} width="20%" />
					<Skeleton height={16} width="20%" />
					<Skeleton height={16} width="15%" />
				</div>
			))}
		</div>
	);
}
