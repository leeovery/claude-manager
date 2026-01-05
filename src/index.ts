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
  getPackageVersion,
} from './lib/copier.js';

export {
  injectPrepareHook,
  hasPrepareHook,
  removePrepareHook,
} from './lib/hooks.js';

export {
  syncPlugins,
  addPluginToProject,
  listPlugins,
  removePluginFromProject,
  type SyncResult,
  type AddResult,
  type ListResult,
  type RemoveResult,
} from './lib/sync.js';
