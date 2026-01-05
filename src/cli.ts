import { program } from 'commander';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    // In dist/, package.json is one level up
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}
import {
  readManifest,
  writeManifest,
  cleanupManifestFiles,
  addPlugin,
  getPlugins,
} from './lib/manifest.js';
import {
  copyPluginAssets,
  findPluginInNodeModules,
  hasAssets,
  getPackageVersion,
} from './lib/copier.js';
import { injectPrepareHook } from './lib/hooks.js';

function findProjectRoot(): string {
  // Start from cwd and walk up to find package.json
  let dir = process.cwd();

  while (dir !== '/') {
    if (existsSync(join(dir, 'package.json'))) {
      return dir;
    }
    dir = resolve(dir, '..');
  }

  return process.cwd();
}

program
  .name('claude-plugins')
  .description('Plugin manager for Claude Code skills and commands')
  .version(getVersion());

program
  .command('install')
  .description('Sync all plugins from manifest to .claude directory')
  .option('-f, --force', 'Force sync even if versions match')
  .action((options: { force?: boolean }) => {
    const projectRoot = findProjectRoot();
    const manifest = readManifest(projectRoot);

    const pluginCount = Object.keys(manifest.plugins).length;
    if (pluginCount === 0) {
      console.log('No plugins to sync.');
      return;
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
      }

      if (!needsSync) {
        console.log('All plugins up to date.');
        return;
      }

      console.log(`Syncing Claude plugins (${reason})...`);
    } else {
      console.log('Syncing Claude plugins (forced)...');
    }

    // Clean up existing files from manifest
    const removedFiles = cleanupManifestFiles(projectRoot);
    if (removedFiles.length > 0) {
      console.log(`  Cleaned up ${removedFiles.length} old files`);
    }

    // Re-copy all plugins from manifest
    const newManifest = { plugins: {} as Record<string, { version: string; files: string[] }> };
    const fileOwnership = new Map<string, string>(); // file -> packageName
    const conflicts: string[] = [];
    let totalFiles = 0;
    let removedPlugins: string[] = [];

    for (const [packageName, entry] of Object.entries(manifest.plugins)) {
      const packagePath = findPluginInNodeModules(packageName, projectRoot);

      if (!packagePath) {
        removedPlugins.push(packageName);
        continue;
      }

      if (!hasAssets(packagePath)) {
        console.log(`  Skipping ${packageName} (no assets)`);
        continue;
      }

      const result = copyPluginAssets(packagePath, projectRoot);

      if (result.files.length > 0) {
        // Check for conflicts
        for (const file of result.files) {
          const existingOwner = fileOwnership.get(file);
          if (existingOwner) {
            conflicts.push(`  ${file} (${existingOwner} vs ${packageName})`);
          }
          fileOwnership.set(file, packageName);
        }

        newManifest.plugins[packageName] = {
          version: result.version,
          files: result.files,
        };
        totalFiles += result.files.length;
        console.log(`  Installed ${packageName}@${result.version} (${result.files.length} files)`);
      }
    }

    writeManifest(projectRoot, newManifest);

    // Report removed plugins
    if (removedPlugins.length > 0) {
      console.log(`\nRemoved ${removedPlugins.length} uninstalled plugin(s) from manifest:`);
      for (const name of removedPlugins) {
        console.log(`  - ${name}`);
      }
    }

    // Report conflicts
    if (conflicts.length > 0) {
      console.log(`\nWarning: ${conflicts.length} file conflict(s) detected (later plugin overwrote earlier):`);
      for (const conflict of conflicts) {
        console.log(conflict);
      }
    }

    console.log(`\nDone. ${totalFiles} files from ${Object.keys(newManifest.plugins).length} plugin(s).`);
  });

program
  .command('add')
  .description('Add and install a plugin (called from plugin postinstall)')
  .argument('[package]', 'Package name (auto-detected if run from postinstall)')
  .action((packageArg?: string) => {
    const projectRoot = findProjectRoot();

    // Try to detect package name from npm environment or argument
    const packageName = packageArg || process.env.npm_package_name;

    if (!packageName) {
      console.error('Error: Could not determine package name.');
      console.error('Please provide the package name as an argument: claude-plugins add <package>');
      process.exit(1);
    }

    // Ensure prepare hook is set up (runs on both npm install and npm update)
    if (injectPrepareHook(projectRoot)) {
      console.log('Added prepare hook to package.json');
    }

    const packagePath = findPluginInNodeModules(packageName, projectRoot);

    if (!packagePath) {
      console.error(`Error: Package ${packageName} not found in node_modules`);
      process.exit(1);
    }

    if (!hasAssets(packagePath)) {
      console.log(`Package ${packageName} has no Claude assets to install.`);
      return;
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
      console.log(`Installed ${packageName}@${result.version}:`);
      for (const file of result.files) {
        console.log(`  .claude/${file}`);
      }
    } else {
      console.log(`No assets installed from ${packageName}`);
    }
  });

program
  .command('list')
  .description('List installed plugins and their assets')
  .action(() => {
    const projectRoot = findProjectRoot();
    const plugins = getPlugins(projectRoot);

    const pluginNames = Object.keys(plugins);

    if (pluginNames.length === 0) {
      console.log('No plugins installed.');
      return;
    }

    console.log('Installed Claude plugins:\n');

    for (const [packageName, entry] of Object.entries(plugins)) {
      console.log(`${packageName}@${entry.version}`);
      for (const file of entry.files) {
        console.log(`  .claude/${file}`);
      }
      console.log();
    }
  });

program
  .command('remove')
  .description('Remove a plugin and its assets')
  .argument('<package>', 'Package name to remove')
  .action((packageName: string) => {
    const projectRoot = findProjectRoot();
    const manifest = readManifest(projectRoot);
    const entry = manifest.plugins[packageName];

    if (!entry) {
      console.error(`Plugin ${packageName} is not installed.`);
      process.exit(1);
    }

    const claudeDir = join(projectRoot, '.claude');

    // Remove files
    for (const file of entry.files) {
      const fullPath = join(claudeDir, file);
      if (existsSync(fullPath)) {
        rmSync(fullPath, { recursive: true, force: true });
        console.log(`Removed .claude/${file}`);
      }
    }

    // Update manifest
    delete manifest.plugins[packageName];
    writeManifest(projectRoot, manifest);

    console.log(`Removed ${packageName}`);
  });

program.parse();
