import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HOOK_COMMAND = 'claude-plugins install';

interface PackageJson {
  scripts?: Record<string, string>;
  [key: string]: unknown;
}

export function injectPostinstallHook(projectRoot: string): boolean {
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

    const existingPostinstall = pkg.scripts.postinstall;

    // Check if already has our hook
    if (existingPostinstall?.includes(HOOK_COMMAND)) {
      return false; // Already installed
    }

    // Add or append to postinstall
    if (existingPostinstall) {
      pkg.scripts.postinstall = `${existingPostinstall} && ${HOOK_COMMAND}`;
    } else {
      pkg.scripts.postinstall = HOOK_COMMAND;
    }

    // Write back with same formatting
    writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');

    return true;
  } catch {
    return false;
  }
}

export function hasPostinstallHook(projectRoot: string): boolean {
  const packageJsonPath = join(projectRoot, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const content = readFileSync(packageJsonPath, 'utf-8');
    const pkg: PackageJson = JSON.parse(content);

    return pkg.scripts?.postinstall?.includes(HOOK_COMMAND) ?? false;
  } catch {
    return false;
  }
}

export function removePostinstallHook(projectRoot: string): boolean {
  const packageJsonPath = join(projectRoot, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const content = readFileSync(packageJsonPath, 'utf-8');
    const pkg: PackageJson = JSON.parse(content);

    if (!pkg.scripts?.postinstall) {
      return false;
    }

    const postinstall = pkg.scripts.postinstall;

    if (!postinstall.includes(HOOK_COMMAND)) {
      return false;
    }

    // Remove our hook from the postinstall script
    let newPostinstall = postinstall
      .replace(` && ${HOOK_COMMAND}`, '')
      .replace(`${HOOK_COMMAND} && `, '')
      .replace(HOOK_COMMAND, '');

    if (newPostinstall.trim() === '') {
      delete pkg.scripts.postinstall;
    } else {
      pkg.scripts.postinstall = newPostinstall.trim();
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
