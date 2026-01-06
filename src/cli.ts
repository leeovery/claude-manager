import { program } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  syncPlugins,
  addPluginToProject,
  listPlugins,
  removePluginFromProject,
} from './lib/sync.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function findProjectRoot(): string {
  let dir = process.cwd();

  while (dir !== '/') {
    // Skip node_modules directories - we want the actual project root
    if (!dir.includes('node_modules') && existsSync(join(dir, 'package.json'))) {
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
    const result = syncPlugins(projectRoot, options);

    if (!result.synced) {
      console.log(result.reason || 'Nothing to sync.');
      return;
    }

    if (options.force) {
      console.log('Syncing Claude plugins (forced)...');
    }

    for (const plugin of result.installedPlugins) {
      console.log(`  Installed ${plugin.name}@${plugin.version} (${plugin.fileCount} files)`);
    }

    if (result.removedPlugins.length > 0) {
      console.log(`\nRemoved ${result.removedPlugins.length} uninstalled plugin(s) from manifest:`);
      for (const name of result.removedPlugins) {
        console.log(`  - ${name}`);
      }
    }

    if (result.conflicts.length > 0) {
      console.log(`\nWarning: ${result.conflicts.length} file conflict(s) detected (later plugin overwrote earlier):`);
      for (const conflict of result.conflicts) {
        console.log(`  ${conflict}`);
      }
    }

    console.log(`\nDone. ${result.totalFiles} files from ${result.pluginCount} plugin(s).`);
  });

program
  .command('add')
  .description('Add and install a plugin (called from plugin postinstall)')
  .argument('[package]', 'Package name (auto-detected if run from postinstall)')
  .action((packageArg?: string) => {
    const projectRoot = findProjectRoot();
    const packageName = packageArg || process.env.npm_package_name;

    if (!packageName) {
      console.error('Error: Could not determine package name.');
      console.error('Please provide the package name as an argument: claude-plugins add <package>');
      process.exit(1);
    }

    const result = addPluginToProject(projectRoot, packageName);

    if (result.hookInjected) {
      console.log('Added prepare hook to package.json');
    }

    if (!result.success) {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }

    if (result.files.length === 0) {
      console.log(`Package ${packageName} has no Claude assets to install.`);
      return;
    }

    console.log(`Installed ${packageName}@${result.version}:`);
    for (const file of result.files) {
      console.log(`  .claude/${file}`);
    }
  });

program
  .command('list')
  .description('List installed plugins and their assets')
  .action(() => {
    const projectRoot = findProjectRoot();
    const result = listPlugins(projectRoot);
    const pluginNames = Object.keys(result.plugins);

    if (pluginNames.length === 0) {
      console.log('No plugins installed.');
      return;
    }

    console.log('Installed Claude plugins:\n');

    for (const [packageName, entry] of Object.entries(result.plugins)) {
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
    const result = removePluginFromProject(projectRoot, packageName);

    if (!result.success) {
      console.error(result.error);
      process.exit(1);
    }

    for (const file of result.filesRemoved) {
      console.log(`Removed .claude/${file}`);
    }

    console.log(`Removed ${packageName}`);
  });

program.parse();
