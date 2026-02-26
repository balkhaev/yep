import type { Variants } from "framer-motion";

export const fadeInUp: Variants = {
	hidden: {
		opacity: 0,
		y: 20,
	},
	visible: {
		opacity: 1,
		y: 0,
		transition: {
			duration: 0.4,
			ease: [0.4, 0, 0.2, 1],
		},
	},
};

export const fadeIn: Variants = {
	hidden: {
		opacity: 0,
	},
	visible: {
		opacity: 1,
		transition: {
			duration: 0.3,
			ease: "easeOut",
		},
	},
};

export const scaleIn: Variants = {
	hidden: {
		opacity: 0,
		scale: 0.95,
	},
	visible: {
		opacity: 1,
		scale: 1,
		transition: {
			duration: 0.4,
			ease: [0.4, 0, 0.2, 1],
		},
	},
};

export const slideInFromLeft: Variants = {
	hidden: {
		opacity: 0,
		x: -20,
	},
	visible: {
		opacity: 1,
		x: 0,
		transition: {
			duration: 0.4,
			ease: [0.4, 0, 0.2, 1],
		},
	},
};

export const slideInFromRight: Variants = {
	hidden: {
		opacity: 0,
		x: 20,
	},
	visible: {
		opacity: 1,
		x: 0,
		transition: {
			duration: 0.4,
			ease: [0.4, 0, 0.2, 1],
		},
	},
};

export const staggerContainer: Variants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.08,
			delayChildren: 0.1,
		},
	},
};

export const staggerItem: Variants = {
	hidden: {
		opacity: 0,
		y: 10,
	},
	visible: {
		opacity: 1,
		y: 0,
		transition: {
			duration: 0.3,
			ease: "easeOut",
		},
	},
};
