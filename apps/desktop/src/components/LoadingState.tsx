import { motion } from "framer-motion";
import { SkeletonCard, SkeletonChart, SkeletonTable } from "./Skeleton";

export function PageLoading() {
	return (
		<div className="space-y-8">
			<div className="space-y-2">
				<div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-800/50" />
				<div className="h-5 w-96 animate-pulse rounded-md bg-zinc-800/30" />
			</div>
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
				{Array.from({ length: 5 }).map((_, i) => (
					<div className="card space-y-2 p-4" key={i}>
						<div className="h-4 w-16 animate-pulse rounded bg-zinc-800/50" />
						<div className="h-7 w-20 animate-pulse rounded bg-zinc-700/50" />
						<div className="h-3 w-24 animate-pulse rounded bg-zinc-800/30" />
					</div>
				))}
			</div>
			<div className="grid gap-6 lg:grid-cols-2">
				<SkeletonCard />
				<SkeletonCard />
			</div>
		</div>
	);
}

export function ChartLoading() {
	return (
		<motion.div
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			initial={{ opacity: 0 }}
			transition={{ duration: 0.2 }}
		>
			<SkeletonChart />
		</motion.div>
	);
}

export function TableLoading({ rows = 5 }: { rows?: number }) {
	return (
		<motion.div
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			initial={{ opacity: 0 }}
			transition={{ duration: 0.2 }}
		>
			<SkeletonTable rows={rows} />
		</motion.div>
	);
}

export function CardLoading() {
	return (
		<motion.div
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			initial={{ opacity: 0 }}
			transition={{ duration: 0.2 }}
		>
			<SkeletonCard />
		</motion.div>
	);
}

interface SpinnerProps {
	className?: string;
	size?: "sm" | "md" | "lg";
}

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
	const sizeClasses = {
		sm: "h-4 w-4 border-2",
		md: "h-6 w-6 border-2",
		lg: "h-8 w-8 border-3",
	};

	return (
		<div
			className={`${sizeClasses[size]} animate-spin rounded-full border-zinc-700 border-t-zinc-400 ${className}`}
		/>
	);
}

interface LoadingMessageProps {
	message?: string;
	size?: "sm" | "md" | "lg";
}

export function LoadingMessage({
	message = "Loading...",
	size = "md",
}: LoadingMessageProps) {
	return (
		<div className="flex h-64 items-center justify-center">
			<div className="flex items-center gap-3 text-sm text-zinc-500">
				<Spinner size={size} />
				{message}
			</div>
		</div>
	);
}
