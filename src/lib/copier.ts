import { existsSync, mkdirSync, cpSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, basename } from 'node:path';

const ASSET_DIRS = ['skills', 'commands', 'agents', 'hooks'] as const;
type AssetDir = typeof ASSET_DIRS[number];

interface CopyResult {
  files: string[];
  version: string;
}

export function getPackageVersion(packagePath: string): string {
  try {
    const pkgJson = JSON.parse(readFileSync(join(packagePath, 'package.json'), 'utf-8'));
    return pkgJson.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function copyDirectory(src: string, dest: string): void {
  cpSync(src, dest, { recursive: true });
}

function copyFile(src: string, dest: string): void {
  const destDir = join(dest, '..');
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }
  cpSync(src, dest);
}

function isSkillDirectory(itemPath: string): boolean {
  return statSync(itemPath).isDirectory();
}

function isAssetFile(itemPath: string): boolean {
  const stat = statSync(itemPath);
  const name = basename(itemPath);
  return stat.isFile() && name !== '.gitkeep';
}

export function copyPluginAssets(
  packagePath: string,
  projectRoot: string
): CopyResult {
  const claudeDir = join(projectRoot, '.claude');
  const copiedFiles: string[] = [];

  for (const assetDir of ASSET_DIRS) {
    const sourcePath = join(packagePath, assetDir);

    if (!existsSync(sourcePath)) {
      continue;
    }

    const targetDir = join(claudeDir, assetDir);

    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    const items = readdirSync(sourcePath);

    for (const item of items) {
      if (item === '.gitkeep') continue;

      const itemPath = join(sourcePath, item);
      const targetPath = join(targetDir, item);

      if (assetDir === 'skills') {
        // Skills are directories
        if (isSkillDirectory(itemPath)) {
          copyDirectory(itemPath, targetPath);
          copiedFiles.push(`${assetDir}/${item}`);
        }
      } else {
        // Commands, agents, hooks are files
        if (isAssetFile(itemPath)) {
          copyFile(itemPath, targetPath);
          copiedFiles.push(`${assetDir}/${item}`);
        }
      }
    }
  }

  return {
    files: copiedFiles,
    version: getPackageVersion(packagePath),
  };
}

export function findPluginInNodeModules(
  packageName: string,
  projectRoot: string
): string | null {
  // Standard node_modules path (npm, pnpm, yarn classic, bun)
  const standardPath = join(projectRoot, 'node_modules', packageName);
  if (existsSync(standardPath)) {
    return standardPath;
  }

  // Fallback: use Node's require.resolve for yarn PnP and other setups
  try {
    const require = createRequire(join(projectRoot, 'package.json'));
    const resolved = require.resolve(`${packageName}/package.json`);
    return dirname(resolved);
  } catch {
    return null;
  }
}

export function hasAssets(packagePath: string): boolean {
  for (const assetDir of ASSET_DIRS) {
    const dirPath = join(packagePath, assetDir);
    if (existsSync(dirPath)) {
      const items = readdirSync(dirPath).filter(f => f !== '.gitkeep');
      if (items.length > 0) {
        return true;
      }
    }
  }
  return false;
}
