import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const projectRoot = join(import.meta.dir, "..");
const outdir = join(projectRoot, "build", "revenge");

await mkdir(outdir, { recursive: true });

const externals = [
	"react",
	"react/jsx-runtime",
	"react/jsx-dev-runtime",
	"react-native",
	"@vendetta/patcher",
	"@vendetta/metro",
	"@vendetta/metro/common",
	"@vendetta/plugin",
	"@vendetta/storage",
	"@vendetta/ui/toasts",
	"@vendetta/ui/assets",
	"@vendetta/ui/components",
];

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

// Generate manifest.json for Revenge / Vendetta plugin loader
const manifest = {
	name: "VaultRelay",
	description: "Auto-upload oversized attachments to your self-hosted OpenResty server",
	authors: [{ name: "SCUMBAG0LEE" }],
	main: "index.js",
};

await Bun.write(join(outdir, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`✅ Built successfully to ${outdir}`);
