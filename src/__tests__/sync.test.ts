import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  syncPlugins,
  addPluginToProject,
  listPlugins,
  removePluginFromProject,
} from '../lib/sync.js';

describe('sync', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `claude-manager-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    // Create a basic package.json for the project
    writeFileSync(join(testDir, 'package.json'), JSON.stringify({ name: 'test-project' }));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  function createMockPlugin(name: string, version: string, assets: { skills?: string[]; commands?: string[] }) {
    const pluginDir = join(testDir, 'node_modules', name);
    mkdirSync(pluginDir, { recursive: true });
    writeFileSync(join(pluginDir, 'package.json'), JSON.stringify({ name, version }));

    if (assets.skills) {
      const skillsDir = join(pluginDir, 'skills');
      mkdirSync(skillsDir, { recursive: true });
      for (const skill of assets.skills) {
        const skillDir = join(skillsDir, skill);
        mkdirSync(skillDir, { recursive: true });
        writeFileSync(join(skillDir, 'index.md'), `# ${skill} skill`);
      }
    }

    if (assets.commands) {
      const commandsDir = join(pluginDir, 'commands');
      mkdirSync(commandsDir, { recursive: true });
      for (const command of assets.commands) {
        writeFileSync(join(commandsDir, `${command}.md`), `# ${command} command`);
      }
    }
  }

  function createManifest(plugins: Record<string, { version: string; files: string[] }>) {
    const claudeDir = join(testDir, '.claude');
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(
      join(claudeDir, '.plugins-manifest.json'),
      JSON.stringify({ plugins })
    );
  }

  describe('syncPlugins', () => {
    it('returns early when no plugins in manifest', () => {
      const result = syncPlugins(testDir);

      expect(result.success).toBe(true);
      expect(result.synced).toBe(false);
      expect(result.reason).toBe('No plugins to sync');
    });

    it('returns early when all plugins are up to date', () => {
      createMockPlugin('@test/plugin', '1.0.0', { skills: ['test-skill'] });
      createManifest({
        '@test/plugin': { version: '1.0.0', files: ['skills/test-skill'] },
      });

      // Also create the actual files so they exist
      const skillDir = join(testDir, '.claude', 'skills', 'test-skill');
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, 'index.md'), '# test');

      const result = syncPlugins(testDir);

      expect(result.success).toBe(true);
      expect(result.synced).toBe(false);
      expect(result.reason).toBe('All plugins up to date');
    });

    it('syncs when plugin version changed', () => {
      createMockPlugin('@test/plugin', '2.0.0', { skills: ['test-skill'] });
      createManifest({
        '@test/plugin': { version: '1.0.0', files: ['skills/test-skill'] },
      });

      const result = syncPlugins(testDir);

      expect(result.success).toBe(true);
      expect(result.synced).toBe(true);
      expect(result.installedPlugins).toHaveLength(1);
      expect(result.installedPlugins[0].version).toBe('2.0.0');
    });

    it('syncs when forced even if versions match', () => {
      createMockPlugin('@test/plugin', '1.0.0', { skills: ['test-skill'] });
      createManifest({
        '@test/plugin': { version: '1.0.0', files: ['skills/test-skill'] },
      });

      const result = syncPlugins(testDir, { force: true });

      expect(result.success).toBe(true);
      expect(result.synced).toBe(true);
    });

    it('removes plugins that were uninstalled from node_modules', () => {
      // Create manifest with plugin but don't create plugin in node_modules
      createManifest({
        '@test/removed-plugin': { version: '1.0.0', files: ['skills/old-skill'] },
      });

      const result = syncPlugins(testDir);

      expect(result.success).toBe(true);
      expect(result.synced).toBe(true);
      expect(result.removedPlugins).toContain('@test/removed-plugin');
    });

    it('detects file conflicts between plugins', () => {
      createMockPlugin('@test/plugin-a', '1.0.0', { commands: ['shared'] });
      createMockPlugin('@test/plugin-b', '1.0.0', { commands: ['shared'] });
      createManifest({
        '@test/plugin-a': { version: '0.9.0', files: ['commands/shared.md'] },
        '@test/plugin-b': { version: '0.9.0', files: ['commands/shared.md'] },
      });

      const result = syncPlugins(testDir);

      expect(result.success).toBe(true);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0]).toContain('shared.md');
    });

    it('copies files to .claude directory', () => {
      createMockPlugin('@test/plugin', '1.0.0', {
        skills: ['my-skill'],
        commands: ['my-command'],
      });
      createManifest({
        '@test/plugin': { version: '0.9.0', files: [] },
      });

      syncPlugins(testDir);

      expect(existsSync(join(testDir, '.claude', 'skills', 'my-skill', 'index.md'))).toBe(true);
      expect(existsSync(join(testDir, '.claude', 'commands', 'my-command.md'))).toBe(true);
    });

    it('cleans up old files before copying new ones', () => {
      // Create old file that should be removed
      const oldSkillDir = join(testDir, '.claude', 'skills', 'old-skill');
      mkdirSync(oldSkillDir, { recursive: true });
      writeFileSync(join(oldSkillDir, 'index.md'), '# old');

      createMockPlugin('@test/plugin', '2.0.0', { skills: ['new-skill'] });
      createManifest({
        '@test/plugin': { version: '1.0.0', files: ['skills/old-skill'] },
      });

      syncPlugins(testDir);

      expect(existsSync(join(testDir, '.claude', 'skills', 'old-skill'))).toBe(false);
      expect(existsSync(join(testDir, '.claude', 'skills', 'new-skill'))).toBe(true);
    });
  });

  describe('addPluginToProject', () => {
    it('adds a new plugin successfully', () => {
      createMockPlugin('@test/new-plugin', '1.0.0', { skills: ['new-skill'] });

      const result = addPluginToProject(testDir, '@test/new-plugin');

      expect(result.success).toBe(true);
      expect(result.packageName).toBe('@test/new-plugin');
      expect(result.version).toBe('1.0.0');
      expect(result.files).toContain('skills/new-skill');
      expect(result.alreadyExists).toBe(false);
    });

    it('returns error when package not found', () => {
      const result = addPluginToProject(testDir, '@test/nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('handles package with no assets', () => {
      // Create plugin without any asset directories
      const pluginDir = join(testDir, 'node_modules', '@test/no-assets');
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, 'package.json'), JSON.stringify({ name: '@test/no-assets', version: '1.0.0' }));

      const result = addPluginToProject(testDir, '@test/no-assets');

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(0);
    });

    it('updates existing plugin', () => {
      // First add
      createMockPlugin('@test/plugin', '1.0.0', { skills: ['skill-v1'] });
      addPluginToProject(testDir, '@test/plugin');

      // Update plugin in node_modules
      rmSync(join(testDir, 'node_modules', '@test/plugin'), { recursive: true });
      createMockPlugin('@test/plugin', '2.0.0', { skills: ['skill-v2'] });

      const result = addPluginToProject(testDir, '@test/plugin');

      expect(result.success).toBe(true);
      expect(result.alreadyExists).toBe(true);
      expect(result.version).toBe('2.0.0');
      expect(existsSync(join(testDir, '.claude', 'skills', 'skill-v2'))).toBe(true);
    });

  });

  describe('listPlugins', () => {
    it('returns empty object when no plugins', () => {
      const result = listPlugins(testDir);

      expect(result.plugins).toEqual({});
    });

    it('returns all plugins from manifest', () => {
      createManifest({
        '@test/plugin-a': { version: '1.0.0', files: ['skills/a'] },
        '@test/plugin-b': { version: '2.0.0', files: ['commands/b.md'] },
      });

      const result = listPlugins(testDir);

      expect(Object.keys(result.plugins)).toHaveLength(2);
      expect(result.plugins['@test/plugin-a'].version).toBe('1.0.0');
      expect(result.plugins['@test/plugin-b'].version).toBe('2.0.0');
    });
  });

  describe('removePluginFromProject', () => {
    it('removes plugin and its files', () => {
      createMockPlugin('@test/plugin', '1.0.0', { skills: ['test-skill'] });
      addPluginToProject(testDir, '@test/plugin');

      expect(existsSync(join(testDir, '.claude', 'skills', 'test-skill'))).toBe(true);

      const result = removePluginFromProject(testDir, '@test/plugin');

      expect(result.success).toBe(true);
      expect(result.filesRemoved).toContain('skills/test-skill');
      expect(existsSync(join(testDir, '.claude', 'skills', 'test-skill'))).toBe(false);
    });

    it('returns error when plugin not in manifest', () => {
      const result = removePluginFromProject(testDir, '@test/nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not installed');
    });

    it('updates manifest after removal', () => {
      createMockPlugin('@test/plugin', '1.0.0', { skills: ['test'] });
      addPluginToProject(testDir, '@test/plugin');

      removePluginFromProject(testDir, '@test/plugin');

      const result = listPlugins(testDir);
      expect(result.plugins['@test/plugin']).toBeUndefined();
    });
  });
});
