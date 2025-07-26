import { cloudflareDevProxyVitePlugin as remixCloudflareDevProxy, vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import { defineConfig, type ViteDevServer } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as dotenv from 'dotenv';
import { type PluginOption } from 'vite';

dotenv.config();

export default defineConfig((config) => {
  return {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.env': JSON.stringify(process.env),
      global: 'globalThis'
    },
    build: {
      target: 'esnext',
      minify: config.mode === 'production' ? 'esbuild' : false,
      },
    server: {
      port: 5173,
      strictPort: true,
      hmr: {
        protocol: 'ws',
        host: 'localhost'
      }
    },
    plugins: [
      nodePolyfills({
        include: ['buffer', 'process', 'util', 'stream'],
        globals: {
          Buffer: true,
          process: true,
          global: true,
        },
        protocolImports: true,
        exclude: ['child_process', 'fs', 'path'],
      }),
      {
        name: 'buffer-polyfill',
        transform(code, id) {
          if (id.includes('env.mjs')) {
            return {
              code: `import { Buffer } from 'buffer';\n${code}`,
              map: null,
            };
          }
          return null;
        },
      },
      config.mode !== 'test' && remixCloudflareDevProxy(),
      remixVitePlugin({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_lazyRouteDiscovery: true,
        },
        presets: [remixVitePreset()],
      }),
      UnoCSS({
        mode: 'global',
        configFile: './uno.config.ts',
      }),
      tsconfigPaths(),
      chrome129IssuePlugin(),
      config.mode === 'production' && optimizeCssModules({ 
        apply: 'build',
        silent: true
      }),
    ].filter(Boolean) as PluginOption[],
    envPrefix: [
      'VITE_',
      'OPENAI_LIKE_API_BASE_URL',
      'OLLAMA_API_BASE_URL',
      'LMSTUDIO_API_BASE_URL',
      'TOGETHER_API_BASE_URL',
    ],
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@import "@/styles/variables.scss";`,
          implementation: require('sass-embedded'),
        },
      },
      modules: {
        localsConvention: 'camelCaseOnly',
      },
    },
    optimizeDeps: {
      include: [
        '@remix-run/react',
        '@remix-run/node',
        'react',
        'react-dom',
        '@radix-ui/react-dropdown-menu',
      ],
      esbuildOptions: {
        target: 'esnext',
      },
    },
  };
});

function chrome129IssuePlugin(): PluginOption {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const raw = req.headers['user-agent']?.match(/Chrom(e|ium)\/([0-9]+)\./);

        if (raw) {
          const version = parseInt(raw[2], 10);

          if (version === 129) {
            res.setHeader('content-type', 'text/html');
            res.end(
              '<body><h1>Please use Chrome Canary for testing.</h1><p>Chrome 129 has an issue with JavaScript modules & Vite local development, see <a href="https://github.com/stackblitz/bolt.new/issues/86#issuecomment-2395519258">for more information.</a></p><p><b>Note:</b> This only impacts <u>local development</u>. `pnpm run build` and `pnpm run start` will work fine in this browser.</p></body>',
            );
            return;
          }
        }
        next();
      });
    },
  };
}
