import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

const jsRoot = join(import.meta.dir, "..");
const projectRoot = join(jsRoot, "..");
const pluginsDir = join(projectRoot, "plugins");
const outdirRoot = join(jsRoot, "build");

await mkdir(outdirRoot, { recursive: true });

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
	"@vendetta/commands",
	"@vendetta",
];

const plugins = await readdir(pluginsDir, { withFileTypes: true });

let failed = false;

for (const dirent of plugins) {
	if (!dirent.isDirectory()) continue;
	const pluginName = dirent.name;
	const pluginSrcDir = join(pluginsDir, pluginName, "src");
	const pluginManifest = join(pluginsDir, pluginName, "manifest.json");
	const pluginOutDir = join(outdirRoot, pluginName);

	console.log(`\n🔨 Building ${pluginName}...`);
	await mkdir(pluginOutDir, { recursive: true });

	const result = await Bun.build({
		entrypoints: [join(pluginSrcDir, "index.ts")],
		outdir: pluginOutDir,
		target: "browser",
		format: "esm",
		minify: process.env.NODE_ENV === "production",
		external: externals,
	});

	if (!result.success) {
		console.error(`❌ Bun build failed for ${pluginName}:`);
		for (const log of result.logs) {
			console.error(log);
		}
		failed = true;
		continue;
	}

	const manifestFile = Bun.file(pluginManifest);
	if (await manifestFile.exists()) {
		await Bun.write(join(pluginOutDir, "manifest.json"), manifestFile);
	} else {
		console.warn(`⚠️ Warning: ${pluginName} is missing manifest.json`);
	}

	console.log(`✅ Built ${pluginName} successfully -> js/build/${pluginName}`);
}

if (failed) {
	process.exit(1);
}
