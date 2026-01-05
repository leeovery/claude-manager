import { program } from 'commander';
import { existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
} from './lib/copier.js';
import { injectPostinstallHook } from './lib/hooks.js';

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
  .version('1.0.0');

program
  .command('install')
  .description('Sync all plugins from manifest to .claude directory')
  .action(() => {
    const projectRoot = findProjectRoot();
    const manifest = readManifest(projectRoot);
    const claudeDir = join(projectRoot, '.claude');

    console.log('Syncing Claude plugins...');

    // Clean up existing files from manifest
    const removedFiles = cleanupManifestFiles(projectRoot);
    if (removedFiles.length > 0) {
      console.log(`  Removed ${removedFiles.length} old files`);
    }

    // Re-copy all plugins from manifest
    const newManifest = { plugins: {} as Record<string, { version: string; files: string[] }> };
    let totalFiles = 0;

    for (const [packageName, entry] of Object.entries(manifest.plugins)) {
      const packagePath = findPluginInNodeModules(packageName, projectRoot);

      if (!packagePath) {
        console.log(`  Skipping ${packageName} (not found in node_modules)`);
        continue;
      }

      if (!hasAssets(packagePath)) {
        console.log(`  Skipping ${packageName} (no assets)`);
        continue;
      }

      const result = copyPluginAssets(packagePath, projectRoot);

      if (result.files.length > 0) {
        newManifest.plugins[packageName] = {
          version: result.version,
          files: result.files,
        };
        totalFiles += result.files.length;
        console.log(`  Installed ${packageName}@${result.version} (${result.files.length} files)`);
      }
    }

    writeManifest(projectRoot, newManifest);
    console.log(`Done. ${totalFiles} files installed from ${Object.keys(newManifest.plugins).length} plugins.`);
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

    // Ensure postinstall hook is set up
    if (injectPostinstallHook(projectRoot)) {
      console.log('Added postinstall hook to package.json');
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
