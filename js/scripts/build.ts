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
const builtPlugins: { name: string; description: string; folder: string }[] = [];

for (const dirent of plugins) {
	if (!dirent.isDirectory()) continue;
	const pluginName = dirent.name;
	const pluginSrcDir = join(pluginsDir, pluginName, "src");
	const pluginManifestPath = join(pluginsDir, pluginName, "manifest.json");
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

	const manifestFile = Bun.file(pluginManifestPath);
	let description = "Discord Revenge Plugin";
	if (await manifestFile.exists()) {
		await Bun.write(join(pluginOutDir, "manifest.json"), manifestFile);
		try {
			const json = await manifestFile.json();
			if (json.description) description = json.description;
		} catch {}
	} else {
		console.warn(`⚠️ Warning: ${pluginName} is missing manifest.json`);
	}

	// Generate index.html inside the plugin folder so visiting the directory in browser doesn't 404
	const pluginHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${pluginName} - Revenge Plugin</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background: #0f1015; color: #e2e8f0; padding: 2rem; text-align: center; }
        .card { max-width: 500px; margin: 4rem auto; background: #181920; border: 1px solid #272730; border-radius: 12px; padding: 2rem; }
        h1 { color: #f8fafc; font-size: 1.5rem; margin-bottom: 0.5rem; }
        p { color: #94a3b8; margin-bottom: 1.5rem; }
        a { color: #38bdf8; text-decoration: none; font-weight: 600; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="card">
        <h1>🧩 ${pluginName}</h1>
        <p>${description}</p>
        <p>This is a Discord Revenge plugin directory.</p>
        <a href="../">← Back to Plugin Dashboard</a>
    </div>
</body>
</html>`;
	await Bun.write(join(pluginOutDir, "index.html"), pluginHtml);

	builtPlugins.push({ name: pluginName, description, folder: pluginName });
	console.log(`✅ Built ${pluginName} successfully -> js/build/${pluginName}`);
}

if (failed) {
	process.exit(1);
}

// Generate landing page index.html at js/build/index.html
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SCUMBAG0LEE's Revenge Plugins</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #0f1015;
            color: #e2e8f0;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 2.5rem 1rem;
        }
        .container {
            max-width: 720px;
            width: 100%;
        }
        header {
            text-align: center;
            margin-bottom: 2.5rem;
        }
        h1 {
            font-size: 2rem;
            font-weight: 700;
            background: linear-gradient(135deg, #a855f7, #ec4899);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 0.5rem;
        }
        p.subtitle {
            color: #94a3b8;
            font-size: 1rem;
        }
        .plugin-grid {
            display: grid;
            gap: 1.25rem;
        }
        .card {
            background: #181920;
            border: 1px solid #272730;
            border-radius: 12px;
            padding: 1.5rem;
            transition: transform 0.2s ease, border-color 0.2s ease;
        }
        .card:hover {
            transform: translateY(-2px);
            border-color: #3b3b4f;
        }
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.75rem;
        }
        .plugin-name {
            font-size: 1.25rem;
            font-weight: 600;
            color: #f8fafc;
        }
        .plugin-desc {
            color: #cbd5e1;
            font-size: 0.95rem;
            line-height: 1.5;
            margin-bottom: 1.25rem;
        }
        .url-box {
            display: flex;
            background: #090a0f;
            border: 1px solid #232330;
            border-radius: 8px;
            overflow: hidden;
        }
        .url-input {
            background: transparent;
            border: none;
            color: #a7f3d0;
            font-family: monospace;
            padding: 0.6rem 0.8rem;
            font-size: 0.85rem;
            flex: 1;
            outline: none;
        }
        .copy-btn {
            background: #2563eb;
            color: white;
            border: none;
            padding: 0.6rem 1rem;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
        }
        .copy-btn:hover {
            background: #1d4ed8;
        }
        footer {
            margin-top: 3rem;
            color: #64748b;
            font-size: 0.85rem;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Revenge Plugins Repository</h1>
            <p class="subtitle">Official monorepo for SCUMBAG0LEE's Revenge plugins</p>
        </header>

        <div class="plugin-grid">
            ${builtPlugins
							.map(
								(p) => `
            <div class="card">
                <div class="card-header">
                    <span class="plugin-name">🧩 ${p.name}</span>
                </div>
                <p class="plugin-desc">${p.description}</p>
                <div class="url-box">
                    <input class="url-input" readonly value="https://scumbag0lee.github.io/revenge-plugin/${p.folder}/" id="url-${p.folder}">
                    <button class="copy-btn" onclick="copyUrl('url-${p.folder}', this)">Copy Link</button>
                </div>
            </div>
            `,
							)
							.join("")}
        </div>

        <footer>
            <p>Designed for Discord Revenge Client • Powered by GitHub Pages</p>
        </footer>
    </div>

    <script>
        function copyUrl(id, btn) {
            const input = document.getElementById(id);
            input.select();
            navigator.clipboard.writeText(input.value);
            const orig = btn.innerText;
            btn.innerText = 'Copied!';
            btn.style.background = '#16a34a';
            setTimeout(() => {
                btn.innerText = orig;
                btn.style.background = '#2563eb';
            }, 1500);
        }
    </script>
</body>
</html>`;

await Bun.write(join(outdirRoot, "index.html"), htmlContent);
console.log(`✨ Generated landing page -> js/build/index.html`);
