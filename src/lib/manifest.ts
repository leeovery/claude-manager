import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const MANIFEST_FILE = '.plugins-manifest.json';

export interface PluginEntry {
  version: string;
  files: string[];
}

export interface Manifest {
  plugins: Record<string, PluginEntry>;
}

function getManifestPath(projectRoot: string): string {
  return join(projectRoot, '.claude', MANIFEST_FILE);
}

export function readManifest(projectRoot: string): Manifest {
  const manifestPath = getManifestPath(projectRoot);

  if (!existsSync(manifestPath)) {
    return { plugins: {} };
  }

  try {
    const content = readFileSync(manifestPath, 'utf-8');
    return JSON.parse(content) as Manifest;
  } catch {
    return { plugins: {} };
  }
}

export function writeManifest(projectRoot: string, manifest: Manifest): void {
  const manifestPath = getManifestPath(projectRoot);
  const claudeDir = dirname(manifestPath);

  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

export function addPlugin(
  projectRoot: string,
  packageName: string,
  version: string,
  files: string[]
): void {
  const manifest = readManifest(projectRoot);

  manifest.plugins[packageName] = {
    version,
    files,
  };

  writeManifest(projectRoot, manifest);
}

export function removePlugin(projectRoot: string, packageName: string): void {
  const manifest = readManifest(projectRoot);

  delete manifest.plugins[packageName];

  writeManifest(projectRoot, manifest);
}

export function getPlugins(projectRoot: string): Record<string, PluginEntry> {
  return readManifest(projectRoot).plugins;
}

export function cleanupManifestFiles(projectRoot: string): string[] {
  const manifest = readManifest(projectRoot);
  const claudeDir = join(projectRoot, '.claude');
  const removedFiles: string[] = [];

  for (const [packageName, entry] of Object.entries(manifest.plugins)) {
    for (const file of entry.files) {
      const fullPath = join(claudeDir, file);
      if (existsSync(fullPath)) {
        rmSync(fullPath, { recursive: true, force: true });
        removedFiles.push(file);
      }
    }
  }

  return removedFiles;
}
