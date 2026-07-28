import { mkdir, rename } from "node:fs/promises";
import { join } from "node:path";

const projectRoot = join(import.meta.dir, "..");
const outdir = join(projectRoot, "build", "revenge");

await mkdir(outdir, { recursive: true });

const result = await Bun.build({
	entrypoints: [join(projectRoot, "src", "index.ts")],
	outdir,
	target: "browser",
	format: "esm",
	minify: process.env.NODE_ENV === "production",
	// @vendetta/* modules are provided by the Revenge runtime — don't bundle them
	external: [
		"@vendetta/patcher",
		"@vendetta/metro",
		"@vendetta/metro/common",
		"@vendetta/plugin",
		"@vendetta/storage",
		"@vendetta/ui/toasts",
		"@vendetta/ui/assets",
		"@vendetta/ui/components",
	],
});

if (!result.success) {
	console.error("Bun build failed:");
	for (const log of result.logs) {
		console.error(log);
	}
	process.exit(1);
}

console.log(`✅ Built to ${outdir}`);


