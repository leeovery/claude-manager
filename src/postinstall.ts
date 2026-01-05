/**
 * Postinstall script for claude-manager
 *
 * This runs when claude-manager itself is installed as a dependency.
 * It injects the postinstall hook into the project's package.json
 * so that `claude-plugins install` runs on future npm installs.
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { injectPostinstallHook } from './lib/hooks.js';

function findProjectRoot(): string | null {
  // When running as postinstall of claude-manager,
  // we're in node_modules/claude-manager
  // The project root is two levels up

  // Try environment variable first (set by npm)
  const initCwd = process.env.INIT_CWD;
  if (initCwd && existsSync(join(initCwd, 'package.json'))) {
    return initCwd;
  }

  // Walk up from current directory
  let dir = process.cwd();
  while (dir !== '/') {
    // Skip if we're inside node_modules
    if (!dir.includes('node_modules') && existsSync(join(dir, 'package.json'))) {
      return dir;
    }
    dir = resolve(dir, '..');
  }

  return null;
}

function main() {
  // Skip if running in CI or during package publish
  if (process.env.CI || process.env.npm_config_global) {
    return;
  }

  const projectRoot = findProjectRoot();

  if (!projectRoot) {
    // Can't find project root, skip silently
    return;
  }

  // Inject the postinstall hook
  if (injectPostinstallHook(projectRoot)) {
    console.log('[claude-manager] Added postinstall hook to package.json');
    console.log('[claude-manager] Future npm installs will sync Claude plugins automatically');
  }
}

main();
