import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  readManifest,
  writeManifest,
  addPlugin,
  removePlugin,
  getPlugins,
  cleanupManifestFiles,
} from '../lib/manifest.js';

describe('manifest', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `claude-manager-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('readManifest', () => {
    it('returns empty manifest when file does not exist', () => {
      const manifest = readManifest(testDir);
      expect(manifest).toEqual({ plugins: {} });
    });

    it('reads existing manifest', () => {
      const claudeDir = join(testDir, '.claude');
      mkdirSync(claudeDir, { recursive: true });

      const manifestData = {
        plugins: {
          '@test/plugin': {
            version: '1.0.0',
            files: ['skills/test-skill'],
          },
        },
      };

      writeFileSync(
        join(claudeDir, '.plugins-manifest.json'),
        JSON.stringify(manifestData)
      );

      const manifest = readManifest(testDir);
      expect(manifest).toEqual(manifestData);
    });
  });

  describe('writeManifest', () => {
    it('creates .claude directory if it does not exist', () => {
      const manifest = { plugins: {} };
      writeManifest(testDir, manifest);

      expect(existsSync(join(testDir, '.claude'))).toBe(true);
    });

    it('writes manifest to file', () => {
      const manifest = {
        plugins: {
          '@test/plugin': {
            version: '1.0.0',
            files: ['skills/test-skill'],
          },
        },
      };

      writeManifest(testDir, manifest);

      const content = readFileSync(
        join(testDir, '.claude', '.plugins-manifest.json'),
        'utf-8'
      );
      expect(JSON.parse(content)).toEqual(manifest);
    });
  });

  describe('addPlugin', () => {
    it('adds a plugin to the manifest', () => {
      addPlugin(testDir, '@test/plugin', '1.0.0', ['skills/test-skill']);

      const manifest = readManifest(testDir);
      expect(manifest.plugins['@test/plugin']).toEqual({
        version: '1.0.0',
        files: ['skills/test-skill'],
      });
    });

    it('overwrites existing plugin entry', () => {
      addPlugin(testDir, '@test/plugin', '1.0.0', ['skills/old-skill']);
      addPlugin(testDir, '@test/plugin', '2.0.0', ['skills/new-skill']);

      const manifest = readManifest(testDir);
      expect(manifest.plugins['@test/plugin']).toEqual({
        version: '2.0.0',
        files: ['skills/new-skill'],
      });
    });
  });

  describe('removePlugin', () => {
    it('removes a plugin from the manifest', () => {
      addPlugin(testDir, '@test/plugin', '1.0.0', ['skills/test-skill']);
      removePlugin(testDir, '@test/plugin');

      const manifest = readManifest(testDir);
      expect(manifest.plugins['@test/plugin']).toBeUndefined();
    });
  });

  describe('getPlugins', () => {
    it('returns all plugins from manifest', () => {
      addPlugin(testDir, '@test/plugin-a', '1.0.0', ['skills/a']);
      addPlugin(testDir, '@test/plugin-b', '2.0.0', ['skills/b']);

      const plugins = getPlugins(testDir);
      expect(Object.keys(plugins)).toHaveLength(2);
      expect(plugins['@test/plugin-a']).toBeDefined();
      expect(plugins['@test/plugin-b']).toBeDefined();
    });
  });

  describe('cleanupManifestFiles', () => {
    it('removes files listed in manifest', () => {
      const claudeDir = join(testDir, '.claude');
      const skillsDir = join(claudeDir, 'skills', 'test-skill');
      mkdirSync(skillsDir, { recursive: true });
      writeFileSync(join(skillsDir, 'skill.md'), 'test');

      addPlugin(testDir, '@test/plugin', '1.0.0', ['skills/test-skill']);

      const removed = cleanupManifestFiles(testDir);
      expect(removed).toContain('skills/test-skill');
      expect(existsSync(skillsDir)).toBe(false);
    });
  });
});
