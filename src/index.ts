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
} from './lib/copier.js';

export {
  injectPostinstallHook,
  hasPostinstallHook,
  removePostinstallHook,
} from './lib/hooks.js';
