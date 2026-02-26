import { motion } from "framer-motion";
import type { ReactNode } from "react";
import {
	fadeIn,
	fadeInUp,
	scaleIn,
	slideInFromLeft,
	slideInFromRight,
	staggerContainer,
	staggerItem,
} from "@/lib/motion";

interface MotionWrapperProps {
	children: ReactNode;
	className?: string;
	delay?: number;
}

export function FadeInUp({ children, className, delay }: MotionWrapperProps) {
	return (
		<motion.div
			animate="visible"
			className={className}
			initial="hidden"
			transition={{ delay }}
			variants={fadeInUp}
		>
			{children}
		</motion.div>
	);
}

export function FadeIn({ children, className, delay }: MotionWrapperProps) {
	return (
		<motion.div
			animate="visible"
			className={className}
			initial="hidden"
			transition={{ delay }}
			variants={fadeIn}
		>
			{children}
		</motion.div>
	);
}

export function ScaleIn({ children, className, delay }: MotionWrapperProps) {
	return (
		<motion.div
			animate="visible"
			className={className}
			initial="hidden"
			transition={{ delay }}
			variants={scaleIn}
		>
			{children}
		</motion.div>
	);
}

export function SlideInFromLeft({
	children,
	className,
	delay,
}: MotionWrapperProps) {
	return (
		<motion.div
			animate="visible"
			className={className}
			initial="hidden"
			transition={{ delay }}
			variants={slideInFromLeft}
		>
			{children}
		</motion.div>
	);
}

export function SlideInFromRight({
	children,
	className,
	delay,
}: MotionWrapperProps) {
	return (
		<motion.div
			animate="visible"
			className={className}
			initial="hidden"
			transition={{ delay }}
			variants={slideInFromRight}
		>
			{children}
		</motion.div>
	);
}

export function StaggerContainer({
	children,
	className,
}: Omit<MotionWrapperProps, "delay">) {
	return (
		<motion.div
			animate="visible"
			className={className}
			initial="hidden"
			variants={staggerContainer}
		>
			{children}
		</motion.div>
	);
}

export function StaggerItem({
	children,
	className,
}: Omit<MotionWrapperProps, "delay">) {
	return (
		<motion.div className={className} variants={staggerItem}>
			{children}
		</motion.div>
	);
}
