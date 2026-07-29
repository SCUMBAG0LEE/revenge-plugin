import { existsSync } from 'node:fs'
import { mkdir, readdir, cp } from 'node:fs/promises'
import { extname } from 'node:path'
import cjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import swc from '@swc/core'
import { rollup } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'
import tsConfigPaths from 'rollup-plugin-tsconfig-paths'

const extensions = ['.js', '.jsx', '.mjs', '.ts', '.tsx', '.cts', '.mts']
const plugins = process.argv.slice(2).filter(x => !x.startsWith('-'))
const dev = process.argv.includes('--dev') || process.argv.includes('-d')

const hasher = new Bun.CryptoHasher('sha256')

const ImportMap = {
    react: 'React',
    'react-native': 'ReactNative',
} as Record<string, string>

if (!existsSync('./dist')) await mkdir('./dist')

const builtPlugins: { name: string; description: string; folder: string }[] = [];

for (const plugin of plugins.length ? plugins : await readdir('./plugins')) {
    console.log(`\n📦 Building ${plugin}...`)
    const manifest = await Bun.file(`./plugins/${plugin}/manifest.json`).json()

    try {
        const bundle = await rollup({
            input: `./plugins/${plugin}/${manifest.main}`,
            watch: {
                include: `./plugins/${plugin}/**`,
            },
            onwarn(warning) {
                if (warning.code === 'MISSING_NAME_OPTION_FOR_IIFE_EXPORT') return
                return console.warn(warning.message)
            },
            external: id => Boolean(id.match(/^@(revenge-mod|vendetta)/)) || !!ImportMap[id],
            plugins: [
                tsConfigPaths(),
                nodeResolve(),
                cjs(),
                {
                    name: 'swc',
                    async transform(code, id) {
                        const ext = extname(id)
                        if (!extensions.includes(ext)) return null

                        const ts = ext.includes('ts')
                        const tsx = ts ? ext.endsWith('x') : undefined
                        const jsx = !ts ? ext.endsWith('x') : undefined

                        const result = await swc.transform(code, {
                            filename: id,
                            jsc: {
                                externalHelpers: false,
                                parser: {
                                    syntax: ts ? 'typescript' : 'ecmascript',
                                    tsx,
                                    jsx,
                                },
                            },
                            env: {
                                targets: 'fully supports es6',
                                include: [
                                    'transform-block-scoping',
                                    'transform-classes',
                                    'transform-async-to-generator',
                                    'transform-async-generator-functions',
                                ],
                                exclude: [
                                    'transform-parameters',
                                    'transform-template-literals',
                                    'transform-exponentiation-operator',
                                    'transform-named-capturing-groups-regex',
                                    'transform-nullish-coalescing-operator',
                                    'transform-object-rest-spread',
                                    'transform-optional-chaining',
                                    'transform-logical-assignment-operators',
                                ],
                            },
                        })
                        return result.code
                    },
                },
                {
                    name: 'file-parser',
                    async transform(code, id) {
                        const Parsers = {
                            text: ['html', 'css', 'svg'],
                            raw: ['json'],
                            uri: ['png'],
                        }
                        const ExtToMimeMap = {
                            png: 'image/png',
                        }

                        const ext = extname(id).slice(1)
                        const mode = Object.entries(Parsers).find(([_, v]) => v.includes(ext))?.[0]
                        if (!mode) return null

                        let thing: string

                        if (mode === 'text') thing = JSON.stringify(code)
                        else if (mode === 'raw') thing = code
                        else if (mode === 'uri')
                            thing = JSON.stringify(
                                // @ts-expect-error: Intentional
                                `data:${ExtToMimeMap[ext] ?? ''};base64,${Buffer.from(await Bun.file(id).arrayBuffer()).toString('base64')}`,
                            )
                        else throw new Error(`Unable to parse file (no mode specified): ${id}`)

                        if (thing) return { code: `export default ${thing}` }
                    },
                },
                esbuild({
                    minifySyntax: !dev,
                    minifyWhitespace: !dev,
                    define: {
                        IS_DEV: String(dev),
                    },
                }),
            ],
        })

        if (!existsSync(`./dist/${plugin}`)) await mkdir(`./dist/${plugin}`)

        const code = await bundle
            .write({
                file: `./dist/${plugin}/index.js`,
                globals(id) {
                    if (ImportMap[id]) return ImportMap[id]

                    const replaceSlashWithDot = (s: string) => s.replaceAll('/', '.')

                    if (id.startsWith('@vendetta')) return replaceSlashWithDot(id.substring(1))
                    if (id.startsWith('@revenge-mod')) return `bunny${replaceSlashWithDot(id.substring(12))}`
                    if (id.startsWith('@revenge-mod/revenge/src')) {
                        console.warn('Importing from `node_modules`, please change.')
                        const path = id.substring(25)
                        if (path.startsWith('metro')) return `bunny.${replaceSlashWithDot(path)}`
                        if (path.startsWith('lib')) return `bunny.${replaceSlashWithDot(path.substring(3))}`
                        console.warn(`Unable to resolve import path for "${path}"!`)
                    }

                    throw new Error(`Unable to resolve import path for: ${id}`)
                },
                format: 'iife',
                compact: true,
                exports: 'named',
            })
            .then(result => result.output[0].code)

        await bundle.close()

        manifest.main = 'index.js'
        manifest.hash = await hasher.update(code).digest('hex')
        await Bun.write(`./dist/${plugin}/manifest.json`, JSON.stringify(manifest))

        // Generate a fallback index.html to prevent 404s when users click the plugin link
        await Bun.write(`./dist/${plugin}/index.html`, `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=https://scumbag0lee.github.io/revenge-plugin/"></head><body><p>This is a Revenge plugin. Copy this URL into the Revenge plugin installer in Discord.</p></body></html>`);

        builtPlugins.push({ name: manifest.name, description: manifest.description || "Discord Revenge Plugin", folder: plugin });
        console.log(`✅ Successfully built: ${manifest.name}`)
    } catch (e) {
        console.error(`❌ Failed to build plugin ${manifest.name}:`, e)
        process.exit(1)
    }
}

// Generate landing page index.html at dist/index.html
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SCUMBAG0LEE's Revenge Plugins</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #050505;
            --card-bg: rgba(20, 20, 25, 0.6);
            --card-border: rgba(255, 255, 255, 0.08);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent-primary: #8b5cf6;
            --accent-secondary: #ec4899;
            --glass-blur: blur(16px);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 3rem 1.5rem;
            position: relative;
            overflow-x: hidden;
        }

        /* Animated Background Gradients */
        .bg-orb {
            position: absolute;
            border-radius: 50%;
            filter: blur(100px);
            z-index: -1;
            opacity: 0.5;
            animation: float 20s infinite ease-in-out;
        }
        .orb-1 {
            width: 400px;
            height: 400px;
            background: rgba(139, 92, 246, 0.4);
            top: -10%;
            left: -10%;
            animation-delay: 0s;
        }
        .orb-2 {
            width: 500px;
            height: 500px;
            background: rgba(236, 72, 153, 0.3);
            bottom: -20%;
            right: -10%;
            animation-delay: -5s;
        }
        .orb-3 {
            width: 300px;
            height: 300px;
            background: rgba(56, 189, 248, 0.3);
            top: 40%;
            left: 50%;
            transform: translate(-50%, -50%);
            animation-delay: -10s;
        }

        @keyframes float {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-50px) scale(1.1); }
        }

        .container {
            max-width: 800px;
            width: 100%;
            z-index: 1;
        }

        header {
            text-align: center;
            margin-bottom: 4rem;
            animation: fadeDown 0.8s ease-out forwards;
        }

        h1 {
            font-family: 'Outfit', sans-serif;
            font-size: 3.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, #fff, #94a3b8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 1rem;
            letter-spacing: -1px;
        }

        .subtitle {
            color: var(--text-secondary);
            font-size: 1.15rem;
            font-weight: 400;
        }

        .plugin-grid {
            display: grid;
            gap: 1.5rem;
            animation: fadeUp 0.8s ease-out forwards;
            animation-delay: 0.2s;
            opacity: 0;
        }

        .card {
            background: var(--card-bg);
            backdrop-filter: var(--glass-blur);
            -webkit-backdrop-filter: var(--glass-blur);
            border: 1px solid var(--card-border);
            border-radius: 16px;
            padding: 2rem;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }

        .card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; height: 1px;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .card:hover {
            transform: translateY(-4px) scale(1.01);
            border-color: rgba(255, 255, 255, 0.15);
            box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 40px rgba(139, 92, 246, 0.1);
        }

        .card:hover::before {
            opacity: 1;
        }

        .card-header {
            display: flex;
            align-items: center;
            margin-bottom: 1rem;
        }

        .plugin-name {
            font-family: 'Outfit', sans-serif;
            font-size: 1.5rem;
            font-weight: 600;
            color: var(--text-primary);
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .plugin-desc {
            color: var(--text-secondary);
            font-size: 1rem;
            line-height: 1.6;
            margin-bottom: 1.5rem;
        }

        .url-box {
            display: flex;
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 12px;
            overflow: hidden;
            transition: border-color 0.2s ease;
        }
        
        .url-box:focus-within {
            border-color: var(--accent-primary);
        }

        .url-input {
            background: transparent;
            border: none;
            color: #a78bfa;
            font-family: 'Inter', monospace;
            padding: 1rem 1.25rem;
            font-size: 0.9rem;
            flex: 1;
            outline: none;
        }

        .copy-btn {
            background: rgba(139, 92, 246, 0.15);
            color: #ddd;
            border: none;
            border-left: 1px solid rgba(255,255,255,0.05);
            padding: 0 1.5rem;
            font-family: 'Outfit', sans-serif;
            font-size: 0.95rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .copy-btn:hover {
            background: var(--accent-primary);
            color: white;
        }

        .copy-btn:active {
            transform: scale(0.95);
        }

        footer {
            margin-top: 5rem;
            color: #475569;
            font-size: 0.9rem;
            text-align: center;
            animation: fadeUp 0.8s ease-out forwards;
            animation-delay: 0.4s;
            opacity: 0;
        }

        @keyframes fadeDown {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 640px) {
            h1 { font-size: 2.5rem; }
            .card { padding: 1.5rem; }
            .url-box { flex-direction: column; }
            .copy-btn { padding: 1rem; border-left: none; border-top: 1px solid rgba(255,255,255,0.05); }
        }
    </style>
</head>
<body>
    <div class="bg-orb orb-1"></div>
    <div class="bg-orb orb-2"></div>
    <div class="bg-orb orb-3"></div>

    <div class="container">
        <header>
            <h1>Revenge Plugins</h1>
            <p class="subtitle">Premium modifications for the Discord Revenge Client</p>
        </header>

        <div class="plugin-grid">
            ${builtPlugins
                .map(
                    (p) => `
            <div class="card">
                <div class="card-header">
                    <span class="plugin-name">✨ ${p.name}</span>
                </div>
                <p class="plugin-desc">${p.description}</p>
                <div class="url-box">
                    <input class="url-input" readonly value="https://scumbag0lee.github.io/revenge-plugin/${p.folder}/" id="url-${p.folder}">
                    <button class="copy-btn" onclick="copyUrl('url-${p.folder}', this)">Copy Link</button>
                </div>
            </div>
            `
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
            btn.innerText = 'Copied! ✓';
            btn.style.background = '#10b981';
            btn.style.color = '#fff';
            
            setTimeout(() => {
                btn.innerText = orig;
                btn.style.background = '';
                btn.style.color = '';
            }, 2000);
        }
    </script>
</body>
</html>`;

await Bun.write("./dist/index.html", htmlContent);
console.log(`✨ Generated landing page -> dist/index.html`);
