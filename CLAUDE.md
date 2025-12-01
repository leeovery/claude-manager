# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Composer plugin for managing Claude Code skills and commands. It automatically symlinks plugin assets to `.claude/` directories when packages with `type: "claude-plugin"` are installed.

## Commands

```bash
# Lint/format
vendor/bin/pint

# List installed plugins
vendor/bin/claude-plugins list

# Manual install trigger
vendor/bin/claude-plugins install
```

## Architecture

**Core Components:**

- `ComposerPlugin` - Composer event subscriber, hooks into `post-install-cmd`/`post-update-cmd`
- `PluginManager` - Handles symlinking skills/commands from vendor packages to `.claude/`, manages `.gitignore` sections

**Console Commands (in `src/Console/`):**

- `InstallCommand` - Runs `composer install` to trigger hooks
- `ListCommand` - Shows installed skills/commands with source paths

**Flow:**
1. Composer installs package with `type: "claude-plugin"`
2. `ComposerPlugin::installPlugins()` fires
3. `PluginManager` auto-discovers `skills/` and `commands/` dirs in package
4. Creates symlinks to `.claude/skills/` and `.claude/commands/`
5. Updates `.gitignore` with package-specific sections (sorted by package name)

## Plugin Package Format

Plugins require:
- `"type": "claude-plugin"` in composer.json
- `skills/` dir with subdirectories (skill definitions)
- `commands/` dir with `.md` files (slash commands)
