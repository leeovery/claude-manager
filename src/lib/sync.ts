import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import {
  readManifest,
  writeManifest,
  cleanupManifestFiles,
  addPlugin,
  removePlugin,
  type PluginEntry,
} from './manifest.js';
import {
  copyPluginAssets,
  findPluginInNodeModules,
  hasAssets,
  getPackageVersion,
  getDiscoverableFiles,
} from './copier.js';

export interface SyncResult {
  success: boolean;
  synced: boolean;
  reason?: string;
  totalFiles: number;
  pluginCount: number;
  removedPlugins: string[];
  conflicts: string[];
  installedPlugins: Array<{ name: string; version: string; fileCount: number }>;
}

export interface AddResult {
  success: boolean;
  alreadyExists: boolean;
  packageName: string;
  version?: string;
  files: string[];
  error?: string;
}

export interface ListResult {
  plugins: Record<string, PluginEntry>;
}

export interface RemoveResult {
  success: boolean;
  packageName: string;
  filesRemoved: string[];
  error?: string;
}

export function syncPlugins(
  projectRoot: string,
  options: { force?: boolean } = {}
): SyncResult {
  const manifest = readManifest(projectRoot);
  const pluginCount = Object.keys(manifest.plugins).length;

  if (pluginCount === 0) {
    return {
      success: true,
      synced: false,
      reason: 'No plugins to sync',
      totalFiles: 0,
      pluginCount: 0,
      removedPlugins: [],
      conflicts: [],
      installedPlugins: [],
    };
  }

  // Check if any plugins have changed (unless --force)
  if (!options.force) {
    let needsSync = false;
    let reason = '';

    for (const [packageName, entry] of Object.entries(manifest.plugins)) {
      const packagePath = findPluginInNodeModules(packageName, projectRoot);

      if (!packagePath) {
        needsSync = true;
        reason = `${packageName} was uninstalled`;
        break;
      }

      const currentVersion = getPackageVersion(packagePath);
      if (currentVersion !== entry.version) {
        needsSync = true;
        reason = `${packageName} changed (${entry.version} → ${currentVersion})`;
        break;
      }

      // Check if discoverable files differ from manifest (new asset dirs supported)
      const discoverableFiles = getDiscoverableFiles(packagePath);
      const manifestFiles = [...entry.files].sort();
      if (JSON.stringify(discoverableFiles) !== JSON.stringify(manifestFiles)) {
        needsSync = true;
        reason = `${packageName} has new discoverable assets`;
        break;
      }
    }

    if (!needsSync) {
      return {
        success: true,
        synced: false,
        reason: 'All plugins up to date',
        totalFiles: 0,
        pluginCount,
        removedPlugins: [],
        conflicts: [],
        installedPlugins: [],
      };
    }
  }

  // Clean up existing files from manifest
  cleanupManifestFiles(projectRoot);

  // Re-copy all plugins from manifest
  const newManifest = { plugins: {} as Record<string, PluginEntry> };
  const fileOwnership = new Map<string, string>();
  const conflicts: string[] = [];
  const removedPlugins: string[] = [];
  const installedPlugins: Array<{ name: string; version: string; fileCount: number }> = [];
  let totalFiles = 0;

  for (const [packageName] of Object.entries(manifest.plugins)) {
    const packagePath = findPluginInNodeModules(packageName, projectRoot);

    if (!packagePath) {
      removedPlugins.push(packageName);
      continue;
    }

    if (!hasAssets(packagePath)) {
      continue;
    }

    const result = copyPluginAssets(packagePath, projectRoot);

    if (result.files.length > 0) {
      // Check for conflicts
      for (const file of result.files) {
        const existingOwner = fileOwnership.get(file);
        if (existingOwner) {
          conflicts.push(`${file} (${existingOwner} vs ${packageName})`);
        }
        fileOwnership.set(file, packageName);
      }

      newManifest.plugins[packageName] = {
        version: result.version,
        files: result.files,
      };
      totalFiles += result.files.length;
      installedPlugins.push({
        name: packageName,
        version: result.version,
        fileCount: result.files.length,
      });
    }
  }

  writeManifest(projectRoot, newManifest);

  return {
    success: true,
    synced: true,
    totalFiles,
    pluginCount: Object.keys(newManifest.plugins).length,
    removedPlugins,
    conflicts,
    installedPlugins,
  };
}

export function addPluginToProject(
  projectRoot: string,
  packageName: string
): AddResult {
  const packagePath = findPluginInNodeModules(packageName, projectRoot);

  if (!packagePath) {
    return {
      success: false,
      alreadyExists: false,
      packageName,
      files: [],
      error: `Package ${packageName} not found in node_modules`,
    };
  }

  if (!hasAssets(packagePath)) {
    return {
      success: true,
      alreadyExists: false,
      packageName,
      files: [],
    };
  }

  // Clean up any existing files for this plugin
  const manifest = readManifest(projectRoot);
  const existing = manifest.plugins[packageName];

  if (existing) {
    const claudeDir = join(projectRoot, '.claude');
    for (const file of existing.files) {
      const fullPath = join(claudeDir, file);
      if (existsSync(fullPath)) {
        rmSync(fullPath, { recursive: true, force: true });
      }
    }
  }

  // Copy assets
  const result = copyPluginAssets(packagePath, projectRoot);

  if (result.files.length > 0) {
    addPlugin(projectRoot, packageName, result.version, result.files);
  }

  return {
    success: true,
    alreadyExists: !!existing,
    packageName,
    version: result.version,
    files: result.files,
  };
}

export function listPlugins(projectRoot: string): ListResult {
  const manifest = readManifest(projectRoot);
  return { plugins: manifest.plugins };
}

export function removePluginFromProject(
  projectRoot: string,
  packageName: string
): RemoveResult {
  const manifest = readManifest(projectRoot);
  const entry = manifest.plugins[packageName];

  if (!entry) {
    return {
      success: false,
      packageName,
      filesRemoved: [],
      error: `Plugin ${packageName} is not installed`,
    };
  }

  const claudeDir = join(projectRoot, '.claude');
  const filesRemoved: string[] = [];

  // Remove files
  for (const file of entry.files) {
    const fullPath = join(claudeDir, file);
    if (existsSync(fullPath)) {
      rmSync(fullPath, { recursive: true, force: true });
      filesRemoved.push(file);
    }
  }

  // Update manifest (will delete manifest file if no plugins left)
  removePlugin(projectRoot, packageName);

  return {
    success: true,
    packageName,
    filesRemoved,
  };
}
