import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigationHistory } from "@/hooks/useNavigationHistory";

export default function NavigationControls() {
	const { goBack, goForward, canGoBack, canGoForward } = useNavigationHistory();

	return (
		<div className="flex items-center gap-1">
			<motion.button
				className={`rounded-lg p-2 transition-colors ${
					canGoBack
						? "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
						: "cursor-not-allowed text-zinc-700"
				}`}
				disabled={!canGoBack}
				onClick={goBack}
				type="button"
				whileHover={canGoBack ? { scale: 1.05 } : {}}
				whileTap={canGoBack ? { scale: 0.95 } : {}}
			>
				<ChevronLeft className="h-4 w-4" />
				<span className="sr-only">Go back</span>
			</motion.button>

			<motion.button
				className={`rounded-lg p-2 transition-colors ${
					canGoForward
						? "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
						: "cursor-not-allowed text-zinc-700"
				}`}
				disabled={!canGoForward}
				onClick={goForward}
				type="button"
				whileHover={canGoForward ? { scale: 1.05 } : {}}
				whileTap={canGoForward ? { scale: 0.95 } : {}}
			>
				<ChevronRight className="h-4 w-4" />
				<span className="sr-only">Go forward</span>
			</motion.button>
		</div>
	);
}
