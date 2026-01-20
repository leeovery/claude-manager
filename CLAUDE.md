# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

npm package for managing Claude Code skills and commands. It automatically copies plugin assets to `.claude/` directories when plugins are installed. Assets are committed to the repository, making them immediately available in Claude Code for Web sessions.

## Commands

```bash
# Build
npm run build

# Development (watch mode)
npm run dev

# List installed plugins
npx claude-plugins list

# Manual install/sync
npx claude-plugins install

# Add a plugin manually
npx claude-plugins add <package-name>

# Remove a plugin
npx claude-plugins remove <package-name>
```

## Architecture

**Core Modules (in `src/lib/`):**

- `manifest.ts` - Reads/writes `.claude/.plugins-manifest.json`, tracks installed plugins and their files
- `copier.ts` - Copies assets from `node_modules` to `.claude/`, auto-discovers skills/commands/agents/hooks/scripts directories
- `hooks.ts` - Manages the `prepare` hook injection into project's `package.json` (runs on both `npm install` and `npm update`)

**Entry Points:**

- `cli.ts` - CLI commands (install, add, list, remove)
- `postinstall.ts` - Runs when @leeovery/claude-manager is installed, injects prepare hook
- `index.ts` - Library exports for programmatic usage

**Flow:**

1. User installs a plugin: `npm install @foo/claude-plugin`
2. Plugin has `@leeovery/claude-manager` as dependency, so manager is installed too
3. Manager's `postinstall` runs, adds `prepare` hook to project's `package.json`
4. Plugin's `postinstall` calls `claude-plugins add`
5. Manager copies assets to `.claude/` and updates manifest
6. On future `npm install` or `npm update`, project's `prepare` hook runs `claude-plugins install`
7. Manager reads manifest, cleans old files, re-copies from all registered plugins

**Manifest Structure (`.claude/.plugins-manifest.json`):**

```json
{
  "plugins": {
    "@foo/claude-nuxt-plugin": {
      "version": "1.0.0",
      "files": [
        "skills/nuxt-skill",
        "commands/nuxt.md"
      ]
    }
  }
}
```

## Plugin Package Format

Plugins should:
- Have `@leeovery/claude-manager` as a dependency
- Add a postinstall script: `"postinstall": "claude-plugins add"`
- Include asset directories:
  - `skills/` - directories containing skill definitions
  - `commands/` - `.md` files for slash commands
  - `agents/` - `.md` files for agent definitions
  - `hooks/` - hook configuration files
  - `scripts/` - executable scripts that commands can reference via hooks in their front matter

**Example plugin package.json:**

```json
{
  "name": "@foo/claude-nuxt-plugin",
  "version": "1.0.0",
  "dependencies": {
    "@leeovery/claude-manager": "^2.0.0"
  },
  "scripts": {
    "postinstall": "claude-plugins add"
  }
}
```

## Tech Stack

- TypeScript
- Node.js 18+
- tsup for building
- commander for CLI
