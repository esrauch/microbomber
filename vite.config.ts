import { execSync } from 'node:child_process';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * `virtual:build-info`: the git commit (and whether there were uncommitted
 * changes) the page's code came from, shown in Settings to rule out a stale
 * tab. On the dev server it's re-read on every full page load.
 */
function buildInfo(): Plugin {
  const id = 'virtual:build-info';
  const resolved = `\0${id}`;
  const git = (args: string): string => {
    try {
      return execSync(`git ${args}`, {
        cwd: import.meta.dirname,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim();
    } catch {
      return '';
    }
  };
  return {
    name: 'build-info',
    resolveId: (source) => (source === id ? resolved : undefined),
    load(source) {
      if (source !== resolved) return undefined;
      const info = {
        commit: git('rev-parse --short HEAD') || 'unknown',
        dirty: git('status --porcelain').length > 0,
        builtAt: new Date().toISOString(),
      };
      return `export default ${JSON.stringify(info)};`;
    },
    configureServer(server) {
      // A page load (its HTML) re-reads git, so the stamp is never older than the page.
      server.middlewares.use((req, _res, next) => {
        const path = (req.url ?? '').split('?')[0] ?? '';
        if (path === '/' || path.endsWith('.html')) {
          const mod = server.moduleGraph.getModuleById(resolved);
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [buildInfo()],
  // Relative base so the build works from any subpath (e.g. GitHub Pages /microbomber/).
  base: './',
  build: { target: 'es2022' },
  server: {
    watch: {
      // Only index.html + ~20 files in src/ affect the client bundle. Ignoring
      // inspiration/ (367 files), tests/, tools/, and dist/—plus polling those ~20
      // files instead of allocating per-dir Linux inotify fds (capped at 128)—stops
      // EMFILE watcher exhaustion from leaving Vite's transform cache stale.
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/inspiration/**',
        '**/tests/**',
        '**/tools/**',
        '**/dist/**',
        '**/.claude/**',
        '**/.github/**',
      ],
      usePolling: true,
      interval: 300,
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    maxWorkers: 2,
  },
});
