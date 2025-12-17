<h1 align="center">Claude Manager</h1>

<p align="center">
  <strong>Composer Plugin for Managing Claude Code Skills & Commands</strong>
</p>

<p align="center">
  <a href="#about">About</a> •
  <a href="#installation">Installation</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#cli-commands">CLI Commands</a> •
  <a href="#creating-plugins">Creating Plugins</a> •
  <a href="#available-plugins">Available Plugins</a> •
  <a href="#troubleshooting">Troubleshooting</a>
</p>

---

## About

Claude Manager is a Composer plugin that automatically manages [Claude Code](https://claude.ai/code) skills and commands across your PHP projects.

**What it does:**
- Automatically symlinks skills and commands from plugin packages into your project's `.claude/` directory
- Manages your `.gitignore` so symlinked plugins are excluded while custom skills remain committed
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
6. Your `.gitignore` is automatically updated to exclude symlinked plugins
7. Claude Code discovers them automatically

**After installation, your project structure looks like:**

```
your-project/
├── .claude/
│   ├── skills/
│   │   └── laravel-actions → ../../vendor/leeovery/claude-laravel/skills/laravel-actions
│   └── commands/
│       └── artisan-make.md → ../../vendor/leeovery/claude-laravel/commands/artisan-make.md
├── vendor/
│   └── leeovery/
│       ├── claude-manager/
│       └── claude-laravel/
└── composer.json
```

## CLI Commands

The manager provides a CLI tool for managing plugins:

| Command | Description |
|---------|-------------|
| `vendor/bin/claude-plugins list` | Show all installed skills and commands with their source paths |
| `vendor/bin/claude-plugins install` | Manually trigger plugin installation (usually not needed) |

## Creating Plugins

Want to create your own skill or command packages? The easiest way is to use the included scaffolding script.

### Quick Start with create-package

Clone this repository and run the `create-package` script:

```bash
git clone https://github.com/leeovery/claude-manager.git
cd claude-manager
./create-package claude-my-skills
```

This creates a new plugin package in a sibling directory with:

- Correct directory structure (`skills/`, `commands/`)
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
4. Include a `commands/` directory with `.md` command files

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
└── composer.json
```

The manager auto-discovers `skills/` and `commands/` directories—no additional configuration needed.

## Available Plugins

| Package | Description |
|---------|-------------|
| [claude-laravel](https://github.com/leeovery/claude-laravel) | Opinionated Laravel development patterns and practices |
| [claude-nuxt](https://github.com/leeovery/claude-nuxt) | Nuxt.js development skills for Claude Code |
| [claude-technical-workflows](https://github.com/leeovery/claude-technical-workflows) | Technical workflow skills for Claude Code |

*More plugins coming soon!*

## Automatic Gitignore Management

The manager automatically updates your project's `.gitignore` to exclude symlinked plugins while preserving any custom skills and commands you create.

**What gets added:**
```gitignore
# Claude plugins (managed by leeovery/claude-laravel)
/.claude/skills/laravel-actions/
/.claude/commands/artisan-make.md
```

**This ensures:**
- Symlinked plugins from vendor packages are ignored
- Custom/local skills and commands you create can still be committed
- The `.claude/` directory itself remains in version control

## Troubleshooting

### Symlinks not created

Run the install command manually:

```bash
vendor/bin/claude-plugins install
```

### Skills not showing in Claude Code

Check that `.claude/skills/` and `.claude/commands/` exist and contain symlinks:

```bash
ls -la .claude/skills/
ls -la .claude/commands/
```

### Plugin not detected

Verify the plugin's composer.json has:
- `"type": "claude-plugin"`
- `leeovery/claude-manager` as a dependency
- A `skills/` or `commands/` directory with content

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
