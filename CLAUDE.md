# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Composer plugin for managing Claude Code skills and commands. It automatically installs plugin assets to `.claude/` directories when packages with `type: "claude-plugin"` are installed. Supports two installation modes: **symlink** (default) or **copy**.

## Commands

```bash
# Lint/format
vendor/bin/pint

# List installed plugins
vendor/bin/claude-plugins list

# Manual install trigger
vendor/bin/claude-plugins install

# Show/change installation mode
vendor/bin/claude-plugins mode          # Show current mode
vendor/bin/claude-plugins mode copy     # Switch to copy mode
vendor/bin/claude-plugins mode symlink  # Switch to symlink mode
```

## Architecture

**Core Components:**

- `ComposerPlugin` - Composer event subscriber, hooks into `post-install-cmd`/`post-update-cmd`
- `PluginManager` - Handles installing skills/commands/agents/hooks from vendor packages to `.claude/`, manages `.gitignore` sections, supports symlink and copy modes

**Console Commands (in `src/Console/`):**

- `InstallCommand` - Runs `composer install` to trigger hooks
- `ListCommand` - Shows installed skills/commands/agents/hooks with source paths and mode
- `ModeCommand` - Gets or sets the installation mode (symlink/copy)

**Flow:**
1. Composer installs package with `type: "claude-plugin"`
2. `ComposerPlugin::installPlugins()` fires
3. `PluginManager` reads mode from `composer.json` extra.claude-manager.mode
4. Auto-discovers `skills/`, `commands/`, `agents/`, and `hooks/` dirs in package
5. In symlink mode: creates symlinks, updates `.gitignore`
6. In copy mode: copies files with marker files, removes gitignore entries

**Installation Modes:**

| Mode | Assets | Gitignore | Benefits |
|------|--------|-----------|----------|
| `symlink` (default) | Symlinks to vendor/ | Yes | Clean repo, always fresh versions |
| `copy` | Copied files with `.claude-manager` markers | No | Immediate availability, customizable, git-trackable |

**Mode Configuration (in consuming project's composer.json):**
```json
{
    "extra": {
        "claude-manager": {
            "mode": "copy"
        }
    }
}
```

## Plugin Package Format

Plugins require:
- `"type": "claude-plugin"` in composer.json
- `skills/` dir with subdirectories (skill definitions)
- `commands/` dir with `.md` files (slash commands)
- `agents/` dir with `.md` files (agent definitions)
- `hooks/` dir with hook files
