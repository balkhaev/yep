import { motion } from "framer-motion";
import type { ReactNode } from "react";
import Breadcrumbs from "./Breadcrumbs";
import NavigationControls from "./NavigationControls";

interface PageHeaderProps {
	actions?: ReactNode;
	showBreadcrumbs?: boolean;
	subtitle?: string;
	title: string;
}

export default function PageHeader({
	title,
	subtitle,
	actions,
	showBreadcrumbs = true,
}: PageHeaderProps) {
	return (
		<div className="mb-8 space-y-4">
			{showBreadcrumbs && (
				<motion.div
					animate={{ opacity: 1, y: 0 }}
					className="flex items-center gap-3"
					initial={{ opacity: 0, y: -10 }}
					transition={{ duration: 0.3 }}
				>
					<NavigationControls />
					<Breadcrumbs />
				</motion.div>
			)}
			<motion.div
				animate={{ opacity: 1, y: 0 }}
				className="flex items-start justify-between gap-4"
				initial={{ opacity: 0, y: 10 }}
				transition={{ duration: 0.4, delay: 0.1 }}
			>
				<div className="min-w-0 flex-1 space-y-2">
					<h1 className="font-bold text-3xl text-zinc-100 tracking-tight">
						{title}
					</h1>
					{subtitle && (
						<p className="max-w-2xl text-base text-zinc-400">{subtitle}</p>
					)}
				</div>
				{actions && (
					<div className="flex flex-shrink-0 items-center gap-3">{actions}</div>
				)}
			</motion.div>
		</div>
	);
}
