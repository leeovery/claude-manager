/**
 * Postinstall script for claude-manager
 *
 * This runs when claude-manager itself is installed as a dependency.
 * It injects a 'prepare' hook into the project's package.json
 * so that `claude-plugins install` runs on both npm install AND npm update.
 */

import { existsSync, symlinkSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectPrepareHook } from './lib/hooks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

  // Inject the prepare hook (runs on both npm install and npm update)
  if (injectPrepareHook(projectRoot)) {
    console.log('[claude-manager] Added prepare hook to package.json');
    console.log('[claude-manager] Plugins will sync on npm install AND npm update');
  }

  // Ensure bin symlink exists (needed for pnpm which doesn't link transitive dep bins)
  ensureBinSymlink(projectRoot);
}

function ensureBinSymlink(projectRoot: string): void {
  const binDir = join(projectRoot, 'node_modules', '.bin');
  const binPath = join(binDir, 'claude-plugins');

  // Skip if symlink already exists
  if (existsSync(binPath)) {
    return;
  }

  // Our CLI is in the same directory as this postinstall script (dist/)
  const cliPath = join(__dirname, 'cli.js');

  if (!existsSync(cliPath)) {
    return;
  }

  try {
    // Ensure .bin directory exists
    if (!existsSync(binDir)) {
      mkdirSync(binDir, { recursive: true });
    }

    // Create symlink
    symlinkSync(cliPath, binPath);
  } catch {
    // Silently fail - user can add as direct dependency if needed
  }
}

main();
