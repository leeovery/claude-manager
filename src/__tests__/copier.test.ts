import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  copyPluginAssets,
  findPluginInNodeModules,
  hasAssets,
  getPackageVersion,
} from '../lib/copier.js';

describe('copier', () => {
  let testDir: string;
  let pluginDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `claude-manager-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    pluginDir = join(testDir, 'node_modules', '@test', 'plugin');
    mkdirSync(pluginDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('getPackageVersion', () => {
    it('returns version from package.json', () => {
      writeFileSync(
        join(pluginDir, 'package.json'),
        JSON.stringify({ version: '1.2.3' })
      );

      const version = getPackageVersion(pluginDir);
      expect(version).toBe('1.2.3');
    });

    it('returns 0.0.0 if package.json does not exist', () => {
      const version = getPackageVersion(join(testDir, 'nonexistent'));
      expect(version).toBe('0.0.0');
    });

    it('returns 0.0.0 if version is missing', () => {
      writeFileSync(
        join(pluginDir, 'package.json'),
        JSON.stringify({ name: '@test/plugin' })
      );

      const version = getPackageVersion(pluginDir);
      expect(version).toBe('0.0.0');
    });
  });

  describe('findPluginInNodeModules', () => {
    it('finds plugin in standard node_modules path', () => {
      const result = findPluginInNodeModules('@test/plugin', testDir);
      expect(result).toBe(pluginDir);
    });

    it('returns null if plugin not found', () => {
      const result = findPluginInNodeModules('@test/nonexistent', testDir);
      expect(result).toBeNull();
    });
  });

  describe('hasAssets', () => {
    it('returns true if plugin has skills directory with content', () => {
      const skillsDir = join(pluginDir, 'skills', 'test-skill');
      mkdirSync(skillsDir, { recursive: true });
      writeFileSync(join(skillsDir, 'skill.md'), 'test');

      expect(hasAssets(pluginDir)).toBe(true);
    });

    it('returns true if plugin has commands directory with content', () => {
      const commandsDir = join(pluginDir, 'commands');
      mkdirSync(commandsDir, { recursive: true });
      writeFileSync(join(commandsDir, 'test.md'), 'test');

      expect(hasAssets(pluginDir)).toBe(true);
    });

    it('returns false if plugin has no asset directories', () => {
      expect(hasAssets(pluginDir)).toBe(false);
    });

    it('returns false if asset directories only contain .gitkeep', () => {
      const skillsDir = join(pluginDir, 'skills');
      mkdirSync(skillsDir, { recursive: true });
      writeFileSync(join(skillsDir, '.gitkeep'), '');

      expect(hasAssets(pluginDir)).toBe(false);
    });
  });

  describe('copyPluginAssets', () => {
    beforeEach(() => {
      writeFileSync(
        join(pluginDir, 'package.json'),
        JSON.stringify({ version: '1.0.0' })
      );
    });

    it('copies skills directories', () => {
      const skillsDir = join(pluginDir, 'skills', 'test-skill');
      mkdirSync(skillsDir, { recursive: true });
      writeFileSync(join(skillsDir, 'skill.md'), 'skill content');

      const result = copyPluginAssets(pluginDir, testDir);

      expect(result.version).toBe('1.0.0');
      expect(result.files).toContain('skills/test-skill');

      const copiedSkill = join(testDir, '.claude', 'skills', 'test-skill', 'skill.md');
      expect(existsSync(copiedSkill)).toBe(true);
      expect(readFileSync(copiedSkill, 'utf-8')).toBe('skill content');
    });

    it('copies command files', () => {
      const commandsDir = join(pluginDir, 'commands');
      mkdirSync(commandsDir, { recursive: true });
      writeFileSync(join(commandsDir, 'test.md'), 'command content');

      const result = copyPluginAssets(pluginDir, testDir);

      expect(result.files).toContain('commands/test.md');

      const copiedCommand = join(testDir, '.claude', 'commands', 'test.md');
      expect(existsSync(copiedCommand)).toBe(true);
      expect(readFileSync(copiedCommand, 'utf-8')).toBe('command content');
    });

    it('copies agent files', () => {
      const agentsDir = join(pluginDir, 'agents');
      mkdirSync(agentsDir, { recursive: true });
      writeFileSync(join(agentsDir, 'test.md'), 'agent content');

      const result = copyPluginAssets(pluginDir, testDir);

      expect(result.files).toContain('agents/test.md');
    });

    it('copies hook files', () => {
      const hooksDir = join(pluginDir, 'hooks');
      mkdirSync(hooksDir, { recursive: true });
      writeFileSync(join(hooksDir, 'test.json'), '{}');

      const result = copyPluginAssets(pluginDir, testDir);

      expect(result.files).toContain('hooks/test.json');
    });

    it('skips .gitkeep files', () => {
      const skillsDir = join(pluginDir, 'skills');
      mkdirSync(skillsDir, { recursive: true });
      writeFileSync(join(skillsDir, '.gitkeep'), '');

      const result = copyPluginAssets(pluginDir, testDir);

      expect(result.files).not.toContain('skills/.gitkeep');
    });

    it('returns empty files array if no assets', () => {
      const result = copyPluginAssets(pluginDir, testDir);

      expect(result.files).toHaveLength(0);
      expect(result.version).toBe('1.0.0');
    });
  });
});
