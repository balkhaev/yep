import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
	className?: string;
	duration?: number;
	format?: (n: number) => string;
	value: number;
}

export default function AnimatedNumber({
	value,
	duration = 800,
	className,
	format,
}: AnimatedNumberProps) {
	const [display, setDisplay] = useState(0);
	const rafRef = useRef(0);
	const startRef = useRef({ time: 0, value: 0 });

	useEffect(() => {
		const from = display;
		startRef.current = { time: performance.now(), value: from };

		const animate = (now: number) => {
			const elapsed = now - startRef.current.time;
			const progress = Math.min(elapsed / duration, 1);
			const eased = 1 - (1 - progress) ** 3;
			const current = Math.round(from + (value - from) * eased);
			setDisplay(current);

			if (progress < 1) {
				rafRef.current = requestAnimationFrame(animate);
			}
		};

		rafRef.current = requestAnimationFrame(animate);
		return () => cancelAnimationFrame(rafRef.current);
	}, [value, duration]);

	const formatted = format ? format(display) : display.toLocaleString();

	return <span className={className}>{formatted}</span>;
}
