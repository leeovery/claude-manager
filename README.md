# Claude Code Plugin Manager

A Composer-based plugin system for managing Claude Code skills and commands across your projects.

## Installation

The manager is automatically installed as a dependency of plugin packages. You typically don't install it directly.

## Usage

### Installing Plugins

Add plugin packages to your project:

```bash
composer require --dev leeovery/claude-laravel
composer require --dev leeovery/claude-vue
```

Plugins are automatically installed to `.claude/skills/` and `.claude/commands/` via Composer hooks.

### Listing Installed Plugins

```bash
vendor/bin/claude-plugins list
```

### Manual Installation

If needed, you can manually trigger installation:

```bash
vendor/bin/claude-plugins install
```

### Updating Plugins

```bash
composer update leeovery/claude-laravel
```

The post-update hook automatically reinstalls symlinks.

## How It Works

1. Plugin packages declare `type: "claude-plugin"` in composer.json
2. Composer hooks trigger after install/update
3. Manager scans for all claude-plugin packages
4. Skills are symlinked to `.claude/skills/`
5. Commands are symlinked to `.claude/commands/`
6. Claude Code automatically discovers them
7. `.gitignore` is automatically updated to ignore symlinked plugins

## Automatic Gitignore Management

The manager automatically updates your project's `.gitignore` file to exclude symlinked plugins while preserving custom skills and commands. The following patterns are added:

```
# Claude plugins (managed by Composer)
/.claude/skills/*/
/.claude/commands/*.md
```

This ensures:
- Symlinked plugins from vendor packages are ignored
- Custom/local skills and commands can still be committed
- The `.claude/` directory itself remains in version control

## Creating Plugins

Plugin packages should:

1. Use `type: "claude-plugin"` in composer.json
2. Require `leeovery/claude-manager` as a dependency
3. Define plugin contents in `extra.claude-plugin`

Example plugin composer.json:

```json
{
    "name": "leeovery/claude-laravel",
    "description": "Laravel skills and commands for Claude Code",
    "type": "claude-plugin",
    "license": "MIT",
    "require": {
        "php": "^8.2",
        "leeovery/claude-manager": "^1.0"
    },
    "extra": {
        "claude-plugin": {
            "skills": [
                "skills/laravel-conventions",
                "skills/eloquent"
            ],
            "commands": [
                "commands/review-migration.md",
                "commands/generate-test.md"
            ]
        }
    }
}
```

## Directory Structure

After installation, your project will look like:

```
your-project/
├── .claude/
│   ├── skills/
│   │   └── laravel-conventions → ../../vendor/leeovery/claude-laravel/skills/laravel-conventions
│   └── commands/
│       └── review-migration.md → ../../vendor/leeovery/claude-laravel/commands/review-migration.md
├── vendor/
│   ├── bin/
│   │   └── claude-plugins
│   └── leeovery/
│       ├── claude-manager/
│       └── claude-laravel/
└── composer.json
```

## Available Plugins

- `leeovery/claude-laravel` - Laravel conventions, Eloquent, and Pest testing
- `leeovery/claude-vue` - Vue.js composition API and Pinia state management
- `leeovery/claude-kubernetes` - Kubernetes and Helm deployment patterns

More plugins coming soon!

## Troubleshooting

### Symlinks not created

Run manually:
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
- Manager as a dependency
- Proper `extra.claude-plugin` configuration

## License

MIT
