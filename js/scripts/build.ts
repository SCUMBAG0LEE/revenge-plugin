import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = typeof __dirname !== "undefined"
	? __dirname
	: dirname(fileURLToPath(import.meta.url));

const projectRoot = join(currentDir, "..");
const outdir = join(projectRoot, "build", "revenge");

await mkdir(outdir, { recursive: true });

const externals = [
	"@vendetta/patcher",
	"@vendetta/metro",
	"@vendetta/metro/common",
	"@vendetta/plugin",
	"@vendetta/storage",
	"@vendetta/ui/toasts",
	"@vendetta/ui/assets",
	"@vendetta/ui/components",
];

if (typeof Bun !== "undefined") {
	const result = await Bun.build({
		entrypoints: [join(projectRoot, "src", "index.ts")],
		outdir,
		target: "browser",
		format: "esm",
		minify: process.env.NODE_ENV === "production",
		external: externals,
	});

	if (!result.success) {
		console.error("Bun build failed:");
		for (const log of result.logs) {
			console.error(log);
		}
		process.exit(1);
	}
} else {
	const { build } = await import("esbuild");
	await build({
		entryPoints: [join(projectRoot, "src", "index.ts")],
		outdir,
		target: "es2020",
		format: "esm",
		bundle: true,
		minify: process.env.NODE_ENV === "production",
		external: externals,
	});
}

// Generate manifest.json for Revenge / Vendetta plugin loader
const manifest = {
	name: "VaultRelay",
	description: "Auto-upload oversized attachments to your self-hosted OpenResty server",
	authors: [{ name: "SCUMBAG0LEE" }],
	main: "index.js",
};

await Bun.write
	? Bun.write(join(outdir, "manifest.json"), JSON.stringify(manifest, null, 2))
	: (await import("node:fs/promises")).writeFile(
			join(outdir, "manifest.json"),
			JSON.stringify(manifest, null, 2),
	  );

console.log(`✅ Built to ${outdir}`);
