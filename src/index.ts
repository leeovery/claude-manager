import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { addPluginToProject, removePluginFromProject } from './lib/sync.js';

/**
 * Get package name from env var or package.json in cwd
 */
function getPackageName(): string | null {
  // Try env var first (set by npm, sometimes by pnpm)
  if (process.env.npm_package_name) {
    return process.env.npm_package_name;
  }

  // Fall back to reading package.json in cwd (where postinstall runs)
  const pkgPath = join(process.cwd(), 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      return pkg.name || null;
    } catch {
      return null;
    }
  }

  return null;
}

// Main exports for programmatic usage
export {
  readManifest,
  writeManifest,
  addPlugin,
  removePlugin,
  getPlugins,
  cleanupManifestFiles,
  type Manifest,
  type PluginEntry,
} from './lib/manifest.js';

export {
  copyPluginAssets,
  findPluginInNodeModules,
  hasAssets,
  getPackageVersion,
} from './lib/copier.js';

export {
  syncPlugins,
  addPluginToProject,
  listPlugins,
  removePluginFromProject,
  type SyncResult,
  type AddResult,
  type ListResult,
  type RemoveResult,
} from './lib/sync.js';

/**
 * Find project root by walking up from INIT_CWD or cwd
 */
function findProjectRoot(): string {
  // INIT_CWD is set by npm/pnpm to the directory where the command was run
  const initCwd = process.env.INIT_CWD;
  if (initCwd && existsSync(join(initCwd, 'package.json'))) {
    return initCwd;
  }

  let dir = process.cwd();
  while (dir !== '/') {
    if (!dir.includes('node_modules') && existsSync(join(dir, 'package.json'))) {
      return dir;
    }
    dir = resolve(dir, '..');
  }
  return process.cwd();
}

/**
 * Add the current plugin to the project.
 * Called from plugin's postinstall: node -e "require('@leeovery/claude-manager').add()"
 */
export function add(): void {
  const packageName = getPackageName();
  if (!packageName) {
    console.error('[claude-manager] Could not determine package name');
    process.exit(1);
  }

  const projectRoot = findProjectRoot();
  const result = addPluginToProject(projectRoot, packageName);

  if (!result.success) {
    console.error(`[claude-manager] Error: ${result.error}`);
    process.exit(1);
  }

  if (result.files.length === 0) {
    return; // No assets to install, stay silent
  }

  console.log(`[claude-manager] Installed ${packageName}@${result.version}:`);
  for (const file of result.files) {
    console.log(`  .claude/${file}`);
  }
}

/**
 * Remove the current plugin from the project.
 * Called from plugin's preuninstall: node -e "require('@leeovery/claude-manager').remove()"
 */
export function remove(): void {
  const packageName = getPackageName();
  if (!packageName) {
    console.error('[claude-manager] Could not determine package name');
    process.exit(1);
  }

  const projectRoot = findProjectRoot();
  const result = removePluginFromProject(projectRoot, packageName);

  if (!result.success) {
    // Silently ignore if plugin not in manifest (might already be removed)
    return;
  }

  if (result.filesRemoved.length > 0) {
    console.log(`[claude-manager] Removed ${packageName}:`);
    for (const file of result.filesRemoved) {
      console.log(`  .claude/${file}`);
    }
  }
}
