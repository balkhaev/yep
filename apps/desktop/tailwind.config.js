/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	darkMode: "class",
	theme: {
		extend: {
			colors: {
				primary: {
					50: "#eef2ff",
					100: "#e0e7ff",
					200: "#c7d2fe",
					300: "#a5b4fc",
					400: "#818cf8",
					500: "#6366f1",
					600: "#4f46e5",
					700: "#4338ca",
					800: "#3730a3",
					900: "#312e81",
					950: "#1e1b4b",
				},
				accent: {
					50: "#ecfeff",
					100: "#cffafe",
					200: "#a5f3fc",
					300: "#67e8f9",
					400: "#22d3ee",
					500: "#06b6d4",
					600: "#0891b2",
					700: "#0e7490",
					800: "#155e75",
					900: "#164e63",
					950: "#083344",
				},
			},
			fontFamily: {
				sans: [
					"Inter var",
					"Inter",
					"-apple-system",
					"BlinkMacSystemFont",
					"SF Pro Display",
					"Segoe UI",
					"Roboto",
					"sans-serif",
				],
				display: [
					"Cal Sans",
					"Inter",
					"-apple-system",
					"BlinkMacSystemFont",
					"sans-serif",
				],
				mono: ["SF Mono", "Menlo", "Monaco", "Cascadia Code", "monospace"],
			},
			boxShadow: {
				"glow-sm": "0 0 15px rgba(99, 102, 241, 0.15)",
				"glow-md": "0 0 25px rgba(99, 102, 241, 0.25)",
				"glow-lg": "0 0 40px rgba(99, 102, 241, 0.35)",
				"glow-emerald": "0 0 20px rgba(16, 185, 129, 0.25)",
				"glow-cyan": "0 0 20px rgba(6, 182, 212, 0.25)",
				"inner-glow": "inset 0 0 20px rgba(99, 102, 241, 0.1)",
			},
			backgroundImage: {
				"gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
				"gradient-conic":
					"conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
				"gradient-mesh":
					"radial-gradient(at 27% 37%, rgba(99, 102, 241, 0.12) 0px, transparent 50%), radial-gradient(at 97% 21%, rgba(16, 185, 129, 0.12) 0px, transparent 50%), radial-gradient(at 52% 99%, rgba(6, 182, 212, 0.12) 0px, transparent 50%), radial-gradient(at 10% 29%, rgba(168, 85, 247, 0.12) 0px, transparent 50%)",
			},
			animation: {
				shimmer: "shimmer 2s linear infinite",
				"slide-up": "slideUp 0.3s ease-out",
				"fade-in-scale": "fadeInScale 0.4s ease-out",
				"glow-pulse": "glowPulse 2s ease-in-out infinite",
				"spin-slow": "spin 3s linear infinite",
				float: "float 3s ease-in-out infinite",
			},
			keyframes: {
				shimmer: {
					"0%": { backgroundPosition: "-200% 0" },
					"100%": { backgroundPosition: "200% 0" },
				},
				slideUp: {
					"0%": { opacity: "0", transform: "translateY(16px)" },
					"100%": { opacity: "1", transform: "translateY(0)" },
				},
				fadeInScale: {
					"0%": { opacity: "0", transform: "scale(0.95)" },
					"100%": { opacity: "1", transform: "scale(1)" },
				},
				glowPulse: {
					"0%, 100%": { boxShadow: "0 0 20px rgba(99, 102, 241, 0.2)" },
					"50%": { boxShadow: "0 0 30px rgba(99, 102, 241, 0.4)" },
				},
				float: {
					"0%, 100%": { transform: "translateY(0px)" },
					"50%": { transform: "translateY(-10px)" },
				},
			},
			backdropBlur: {
				xs: "2px",
			},
		},
	},
	plugins: [],
};
