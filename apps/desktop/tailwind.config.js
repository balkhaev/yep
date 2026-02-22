/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	darkMode: "class",
	theme: {
		extend: {
			fontFamily: {
				mono: ["SF Mono", "Menlo", "Monaco", "Cascadia Code", "monospace"],
			},
		},
	},
	plugins: [],
};
