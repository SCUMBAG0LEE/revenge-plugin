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
                    (p) => \`
            <div class="card">
                <div class="card-header">
                    <span class="plugin-name">🧩 \${p.name}</span>
                </div>
                <p class="plugin-desc">\${p.description}</p>
                <div class="url-box">
                    <input class="url-input" readonly value="https://scumbag0lee.github.io/revenge-plugin/\${p.folder}/" id="url-\${p.folder}">
                    <button class="copy-btn" onclick="copyUrl('url-\${p.folder}', this)">Copy Link</button>
                </div>
            </div>
            \`
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
</html>\`;

await Bun.write("./dist/index.html", htmlContent);
console.log(\`✨ Generated landing page -> dist/index.html\`);
