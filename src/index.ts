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
  injectPrepareHook,
  hasPrepareHook,
  removePrepareHook,
  // Legacy aliases
  injectPostinstallHook,
  hasPostinstallHook,
  removePostinstallHook,
} from './lib/hooks.js';
