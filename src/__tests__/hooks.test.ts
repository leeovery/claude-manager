import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  injectPrepareHook,
  hasPrepareHook,
  removePrepareHook,
  // Legacy aliases
  injectPostinstallHook,
  hasPostinstallHook,
  removePostinstallHook,
} from '../lib/hooks.js';

describe('hooks', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `claude-manager-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('injectPrepareHook', () => {
    it('adds prepare hook to package.json without scripts', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ name: 'test-project' })
      );

      const result = injectPrepareHook(testDir);

      expect(result).toBe(true);

      const pkg = JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf-8'));
      expect(pkg.scripts.prepare).toBe('claude-plugins install');
    });

    it('adds prepare hook to package.json with empty scripts', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ name: 'test-project', scripts: {} })
      );

      const result = injectPrepareHook(testDir);

      expect(result).toBe(true);

      const pkg = JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf-8'));
      expect(pkg.scripts.prepare).toBe('claude-plugins install');
    });

    it('appends to existing prepare hook', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          scripts: { prepare: 'husky install' },
        })
      );

      const result = injectPrepareHook(testDir);

      expect(result).toBe(true);

      const pkg = JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf-8'));
      expect(pkg.scripts.prepare).toBe('husky install && claude-plugins install');
    });

    it('returns false if hook already exists', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          scripts: { prepare: 'claude-plugins install' },
        })
      );

      const result = injectPrepareHook(testDir);

      expect(result).toBe(false);
    });

    it('returns false if hook already exists in combined script', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          scripts: { prepare: 'husky install && claude-plugins install' },
        })
      );

      const result = injectPrepareHook(testDir);

      expect(result).toBe(false);
    });

    it('returns false if package.json does not exist', () => {
      const result = injectPrepareHook(testDir);
      expect(result).toBe(false);
    });

    it('returns false if package.json is invalid JSON', () => {
      writeFileSync(join(testDir, 'package.json'), 'not valid json');

      const result = injectPrepareHook(testDir);

      expect(result).toBe(false);
    });
  });

  describe('hasPrepareHook', () => {
    it('returns true if hook exists', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          scripts: { prepare: 'claude-plugins install' },
        })
      );

      expect(hasPrepareHook(testDir)).toBe(true);
    });

    it('returns true if hook exists in combined script', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          scripts: { prepare: 'husky install && claude-plugins install' },
        })
      );

      expect(hasPrepareHook(testDir)).toBe(true);
    });

    it('returns false if hook does not exist', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          scripts: { prepare: 'husky install' },
        })
      );

      expect(hasPrepareHook(testDir)).toBe(false);
    });

    it('returns false if no scripts', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ name: 'test-project' })
      );

      expect(hasPrepareHook(testDir)).toBe(false);
    });

    it('returns false if package.json does not exist', () => {
      expect(hasPrepareHook(testDir)).toBe(false);
    });
  });

  describe('removePrepareHook', () => {
    it('removes standalone prepare hook', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          scripts: { prepare: 'claude-plugins install' },
        })
      );

      const result = removePrepareHook(testDir);

      expect(result).toBe(true);

      const pkg = JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf-8'));
      expect(pkg.scripts).toBeUndefined();
    });

    it('removes hook from combined script (at end)', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          scripts: { prepare: 'husky install && claude-plugins install' },
        })
      );

      const result = removePrepareHook(testDir);

      expect(result).toBe(true);

      const pkg = JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf-8'));
      expect(pkg.scripts.prepare).toBe('husky install');
    });

    it('removes hook from combined script (at start)', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          scripts: { prepare: 'claude-plugins install && husky install' },
        })
      );

      const result = removePrepareHook(testDir);

      expect(result).toBe(true);

      const pkg = JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf-8'));
      expect(pkg.scripts.prepare).toBe('husky install');
    });

    it('returns false if hook does not exist', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          scripts: { prepare: 'husky install' },
        })
      );

      const result = removePrepareHook(testDir);

      expect(result).toBe(false);
    });

    it('returns false if no scripts', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ name: 'test-project' })
      );

      const result = removePrepareHook(testDir);

      expect(result).toBe(false);
    });

    it('returns false if package.json does not exist', () => {
      const result = removePrepareHook(testDir);
      expect(result).toBe(false);
    });

    it('preserves other scripts when removing hook', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          scripts: {
            prepare: 'claude-plugins install',
            build: 'tsc',
          },
        })
      );

      removePrepareHook(testDir);

      const pkg = JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf-8'));
      expect(pkg.scripts.build).toBe('tsc');
      expect(pkg.scripts.prepare).toBeUndefined();
    });
  });

  describe('legacy aliases', () => {
    it('injectPostinstallHook is an alias for injectPrepareHook', () => {
      expect(injectPostinstallHook).toBe(injectPrepareHook);
    });

    it('hasPostinstallHook is an alias for hasPrepareHook', () => {
      expect(hasPostinstallHook).toBe(hasPrepareHook);
    });

    it('removePostinstallHook is an alias for removePrepareHook', () => {
      expect(removePostinstallHook).toBe(removePrepareHook);
    });
  });
});
