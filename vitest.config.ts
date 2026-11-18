import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: { "@": path.resolve(__dirname, "./src") },
	},
	test: {
		environment: "jsdom",
		pool: "threads",
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
	},
});
