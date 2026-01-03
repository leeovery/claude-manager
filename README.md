<h1 align="center">Claude Manager</h1>

<p align="center">
  <strong>Composer Plugin for Managing Claude Code Skills & Commands</strong>
</p>

<p align="center">
  <a href="#about">About</a> •
  <a href="#installation">Installation</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#installation-modes">Installation Modes</a> •
  <a href="#cli-commands">CLI Commands</a> •
  <a href="#creating-plugins">Creating Plugins</a> •
  <a href="#available-plugins">Available Plugins</a> •
  <a href="#troubleshooting">Troubleshooting</a>
</p>

---

## About

Claude Manager is a Composer plugin that automatically manages [Claude Code](https://claude.ai/code) skills, commands, agents, and hooks across your PHP projects.

**What it does:**
- Automatically installs skills, commands, agents, and hooks from plugin packages into your project's `.claude/` directory
- Supports two installation modes: **symlink** (default) or **copy**
- Manages your `.gitignore` based on the installation mode
- Provides CLI tools for listing and managing installed plugins
- Works seamlessly with Composer's install/update lifecycle

**Why use it?**

Instead of manually copying skill files between projects, you can install them as Composer packages and let the manager handle the rest. Update a skill package once, run `composer update`, and all your projects get the improvements.

## Installation

The manager is typically installed automatically as a dependency of plugin packages:

```bash
composer require --dev leeovery/claude-laravel
```

If you need to install it directly:

```bash
composer require --dev leeovery/claude-manager
```

That's it. Composer hooks handle everything else.

## How It Works

1. Plugin packages declare `type: "claude-plugin"` in their composer.json
2. When Composer installs or updates packages, the manager hooks are triggered
3. The manager scans for all installed `claude-plugin` packages
4. Skills directories are symlinked to `.claude/skills/`
5. Command files are symlinked to `.claude/commands/`
6. Agent files are symlinked to `.claude/agents/`
7. Hook files are symlinked to `.claude/hooks/`
8. Your `.gitignore` is automatically updated to exclude symlinked plugins
9. Claude Code discovers them automatically

**After installation, your project structure looks like:**

```
your-project/
├── .claude/
│   ├── skills/
│   │   └── laravel-actions → ../../vendor/leeovery/claude-laravel/skills/laravel-actions
│   ├── commands/
│   │   └── artisan-make.md → ../../vendor/leeovery/claude-laravel/commands/artisan-make.md
│   ├── agents/
│   │   └── code-reviewer.md → ../../vendor/leeovery/claude-laravel/agents/code-reviewer.md
│   └── hooks/
│       └── pre-commit.sh → ../../vendor/leeovery/claude-laravel/hooks/pre-commit.sh
├── vendor/
│   └── leeovery/
│       ├── claude-manager/
│       └── claude-laravel/
└── composer.json
```

## Installation Modes

The manager supports two installation modes. On first install, you'll be prompted to choose:

```
Choose installation mode for Claude plugins:

  [1] symlink - Creates symlinks to vendor packages (default)
                Assets are gitignored and always stay up-to-date

  [2] copy    - Copies files from vendor packages
                Assets are committed to git and work immediately
                Recommended for Claude Code on the web

Select mode [1]:
```

Your choice is saved to `composer.json` and applied to all plugins managed by this package.

### Symlink Mode (Default)

Assets are symlinked from `vendor/` to `.claude/` and automatically gitignored.

**Benefits:**
- Keeps your repository clean—plugin assets stay in vendor/
- Always get fresh versions when packages are updated
- No merge conflicts with upstream changes

```bash
# This is the default behavior - no configuration needed
```

### Copy Mode

Assets are copied to `.claude/` and become part of your repository.

**Benefits:**
- Assets are available immediately without running `composer install`
- You can customize and modify installed skills, commands, agents, and hooks
- Use git to track your changes and handle conflicts with upstream updates

```bash
# Switch to copy mode
vendor/bin/claude-plugins mode copy
```

This updates your `composer.json`:

```json
{
    "extra": {
        "claude-manager": {
            "mode": "copy"
        }
    }
}
```

### Mode Comparison

| Aspect | Symlink Mode | Copy Mode |
|--------|--------------|-----------|
| Assets | Symlinks to vendor/ | Copied files in repository |
| Gitignore | Yes (auto-managed) | No (assets can be committed) |
| Customization | Edit vendor files (not recommended) | Edit directly, track with git |
| Updates | Automatic on composer update | Overwrites on composer update |

### Switching Modes

```bash
# Show current mode
vendor/bin/claude-plugins mode

# Switch to copy mode (removes gitignore entries, copies files)
vendor/bin/claude-plugins mode copy

# Switch to symlink mode (adds gitignore entries, creates symlinks)
vendor/bin/claude-plugins mode symlink
```

> **Note:** In copy mode, plugin assets are overwritten during `composer update`. Use git to track your local changes—you can review diffs and resolve conflicts just like any other code update.

## CLI Commands

The manager provides a CLI tool for managing plugins:

| Command | Description |
|---------|-------------|
| `vendor/bin/claude-plugins list` | Show all installed skills, commands, agents, and hooks with their source paths and mode |
| `vendor/bin/claude-plugins install` | Manually trigger plugin installation (usually not needed) |
| `vendor/bin/claude-plugins mode` | Show current installation mode |
| `vendor/bin/claude-plugins mode copy` | Switch to copy mode |
| `vendor/bin/claude-plugins mode symlink` | Switch to symlink mode |

## Creating Plugins

Want to create your own skill or command packages? The easiest way is to use the included scaffolding script.

### Quick Start with create-plugin

Clone this repository and run the `create-plugin` script:

```bash
git clone https://github.com/leeovery/claude-manager.git
cd claude-manager
./create-plugin claude-my-skills
```

This creates a new plugin package in a sibling directory with:

- Correct directory structure (`skills/`, `commands/`, `agents/`, `hooks/`)
- Pre-configured `composer.json` with `type: "claude-plugin"`
- Basic `.gitignore` and `README.md`
- [Anthropic's skill-creator](https://github.com/anthropics/skills/tree/main/skill-creator) skill installed locally to help you write new skills
- Git repository initialized

Then just:

```bash
cd ../claude-my-skills
composer install
```

You're ready to start creating skills with Claude Code's help via the bundled skill-creator.

### Manual Setup

If you prefer to set things up manually:

#### Plugin Requirements

1. Set `type: "claude-plugin"` in composer.json
2. Require `leeovery/claude-manager` as a dependency
3. Include a `skills/` directory with skill subdirectories, and/or
4. Include a `commands/` directory with `.md` command files, and/or
5. Include an `agents/` directory with `.md` agent files, and/or
6. Include a `hooks/` directory with hook files

#### Example composer.json

```json
{
    "name": "your-vendor/claude-your-skills",
    "description": "Your custom skills for Claude Code",
    "type": "claude-plugin",
    "license": "MIT",
    "require": {
        "php": "^8.2",
        "leeovery/claude-manager": "^1.0"
    }
}
```

#### Plugin Structure

```
your-plugin/
├── skills/
│   ├── skill-one/
│   │   └── skill.md
│   └── skill-two/
│       └── skill.md
├── commands/
│   ├── command-one.md
│   └── command-two.md
├── agents/
│   └── agent-one.md
├── hooks/
│   └── pre-commit.sh
└── composer.json
```

The manager auto-discovers `skills/`, `commands/`, `agents/`, and `hooks/` directories—no additional configuration needed.

## Available Plugins

| Package | Description |
|---------|-------------|
| [claude-laravel](https://github.com/leeovery/claude-laravel) | Opinionated Laravel development patterns and practices |
| [claude-nuxt](https://github.com/leeovery/claude-nuxt) | Nuxt.js development skills for Claude Code |
| [claude-technical-workflows](https://github.com/leeovery/claude-technical-workflows) | Technical workflow skills for Claude Code |

*More plugins coming soon!*

## Automatic Gitignore Management

In **symlink mode** (default), the manager automatically updates your project's `.gitignore` to exclude symlinked plugins while preserving any custom skills, commands, agents, and hooks you create.

**What gets added:**
```gitignore
# Claude plugins: leeovery/claude-laravel (start)
/.claude/skills/laravel-actions
/.claude/commands/artisan-make.md
/.claude/agents/code-reviewer.md
/.claude/hooks/pre-commit.sh
# Claude plugins: leeovery/claude-laravel (end)
```

**This ensures:**
- Symlinked plugins from vendor packages are ignored
- Custom/local skills, commands, agents, and hooks you create can still be committed
- The `.claude/` directory itself remains in version control

In **copy mode**, gitignore entries are automatically removed, allowing copied assets to be committed to your repository.

## Troubleshooting

### Symlinks not created

Run the install command manually:

```bash
vendor/bin/claude-plugins install
```

### Skills not showing in Claude Code

Check that `.claude/skills/`, `.claude/commands/`, `.claude/agents/`, and `.claude/hooks/` exist and contain symlinks:

```bash
ls -la .claude/skills/
ls -la .claude/commands/
ls -la .claude/agents/
ls -la .claude/hooks/
```

### Plugin not detected

Verify the plugin's composer.json has:
- `"type": "claude-plugin"`
- `leeovery/claude-manager` as a dependency
- A `skills/`, `commands/`, `agents/`, or `hooks/` directory with content

## Requirements

- PHP ^8.2
- Composer ^2.0

## Contributing

Contributions are welcome! Whether it's:

- Bug fixes
- Documentation improvements
- New features
- Discussion about approaches

Please open an issue first to discuss significant changes.

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  <sub>Built by <a href="https://github.com/leeovery">Lee Overy</a></sub>
</p>
