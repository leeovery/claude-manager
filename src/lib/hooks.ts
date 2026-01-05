import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HOOK_COMMAND = 'claude-plugins install';
// Use 'prepare' instead of 'postinstall' because prepare runs after BOTH:
// - npm install
// - npm update
// This ensures plugins are always synced regardless of which command is used.
const HOOK_NAME = 'prepare';

interface PackageJson {
  scripts?: Record<string, string>;
  [key: string]: unknown;
}

export function injectPrepareHook(projectRoot: string): boolean {
  const packageJsonPath = join(projectRoot, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const content = readFileSync(packageJsonPath, 'utf-8');
    const pkg: PackageJson = JSON.parse(content);

    if (!pkg.scripts) {
      pkg.scripts = {};
    }

    const existingHook = pkg.scripts[HOOK_NAME];

    // Check if already has our hook
    if (existingHook?.includes(HOOK_COMMAND)) {
      return false; // Already installed
    }

    // Add or append to hook
    if (existingHook) {
      pkg.scripts[HOOK_NAME] = `${existingHook} && ${HOOK_COMMAND}`;
    } else {
      pkg.scripts[HOOK_NAME] = HOOK_COMMAND;
    }

    // Write back with same formatting
    writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');

    return true;
  } catch {
    return false;
  }
}

export function hasPrepareHook(projectRoot: string): boolean {
  const packageJsonPath = join(projectRoot, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const content = readFileSync(packageJsonPath, 'utf-8');
    const pkg: PackageJson = JSON.parse(content);

    return pkg.scripts?.[HOOK_NAME]?.includes(HOOK_COMMAND) ?? false;
  } catch {
    return false;
  }
}

export function removePrepareHook(projectRoot: string): boolean {
  const packageJsonPath = join(projectRoot, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const content = readFileSync(packageJsonPath, 'utf-8');
    const pkg: PackageJson = JSON.parse(content);

    if (!pkg.scripts?.[HOOK_NAME]) {
      return false;
    }

    const hook = pkg.scripts[HOOK_NAME];

    if (!hook.includes(HOOK_COMMAND)) {
      return false;
    }

    // Remove our hook from the script
    let newHook = hook
      .replace(` && ${HOOK_COMMAND}`, '')
      .replace(`${HOOK_COMMAND} && `, '')
      .replace(HOOK_COMMAND, '');

    if (newHook.trim() === '') {
      delete pkg.scripts[HOOK_NAME];
    } else {
      pkg.scripts[HOOK_NAME] = newHook.trim();
    }

    // Clean up empty scripts object
    if (Object.keys(pkg.scripts).length === 0) {
      delete pkg.scripts;
    }

    writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');

    return true;
  } catch {
    return false;
  }
}

// Legacy aliases for backwards compatibility
export const injectPostinstallHook = injectPrepareHook;
export const hasPostinstallHook = hasPrepareHook;
export const removePostinstallHook = removePrepareHook;
