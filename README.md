<h1 align="center">Claude Manager</h1>

<p align="center">
  <strong>npm Package for Managing Claude Code Skills & Commands</strong>
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

Claude Manager is an npm package that automatically manages [Claude Code](https://claude.ai/code) skills, commands, agents, and hooks across your projects.

**What it does:**
- Automatically installs skills, commands, agents, and hooks from plugin packages into your project's `.claude/` directory
- Copies assets so they're committed to your repository and available immediately
- Works with any project that has a `package.json` (Node.js, Laravel, Nuxt, etc.)
- Provides CLI tools for listing and managing installed plugins

**Why use it?**

Instead of manually copying skill files between projects, you can install them as npm packages and let the manager handle the rest. Update a skill package once, run `npm update`, and all your projects get the improvements.

**Why npm instead of Composer?**

Most projects—even non-JavaScript ones like Laravel—have a `package.json` for frontend tooling. npm/Node.js is more ubiquitous than PHP/Composer, making this tool accessible to a wider range of projects.

## Installation

The manager is typically installed automatically as a dependency of plugin packages. When you install a Claude plugin:

```bash
npm install @your-org/claude-your-plugin
```

The manager will:
1. Install itself (as a dependency of the plugin)
2. Add a `postinstall` hook to your `package.json`
3. Copy the plugin's assets to `.claude/`

That's it. Future `npm install` runs will automatically sync all plugins.

## How It Works

1. Plugin packages have `claude-manager` as a dependency
2. Plugins register themselves via their `postinstall` script
3. The manager copies skills, commands, agents, and hooks to `.claude/`
4. A manifest (`.claude/.plugins-manifest.json`) tracks what's installed
5. On updates, old files are removed and fresh copies are made
6. Claude Code discovers them automatically

**After installation, your project structure looks like:**

```
your-project/
├── .claude/
│   ├── .plugins-manifest.json
│   ├── skills/
│   │   └── laravel-actions/
│   │       └── skill.md
│   ├── commands/
│   │   └── artisan-make.md
│   ├── agents/
│   │   └── code-reviewer.md
│   └── hooks/
│       └── pre-commit.sh
├── node_modules/
│   └── @your-org/
│       └── claude-your-plugin/
└── package.json
```

## CLI Commands

The manager provides a CLI tool for managing plugins:

| Command | Description |
|---------|-------------|
| `npx claude-plugins list` | Show all installed plugins and their assets |
| `npx claude-plugins install` | Sync all plugins from manifest (runs automatically on npm install) |
| `npx claude-plugins add <package>` | Manually add a plugin |
| `npx claude-plugins remove <package>` | Remove a plugin and its assets |

## Creating Plugins

Want to create your own skill or command packages?

### Plugin Requirements

1. Have `claude-manager` as a dependency
2. Add a `postinstall` script that calls `claude-plugins add`
3. Include asset directories (`skills/`, `commands/`, `agents/`, `hooks/`)

### Example package.json

```json
{
    "name": "@your-org/claude-your-skills",
    "version": "1.0.0",
    "description": "Your custom skills for Claude Code",
    "license": "MIT",
    "dependencies": {
        "claude-manager": "^1.0.0"
    },
    "scripts": {
        "postinstall": "claude-plugins add"
    }
}
```

### Plugin Structure

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
└── package.json
```

The manager auto-discovers `skills/`, `commands/`, `agents/`, and `hooks/` directories—no additional configuration needed.

## Available Plugins

| Package | Description |
|---------|-------------|
| Coming soon | Be the first to create a plugin! |

## Manifest

The manager tracks installed plugins in `.claude/.plugins-manifest.json`:

```json
{
  "plugins": {
    "@your-org/claude-laravel": {
      "version": "1.0.0",
      "files": [
        "skills/laravel-actions",
        "commands/artisan-make.md"
      ]
    }
  }
}
```

This file should be committed to your repository. It ensures:
- Plugins are synced correctly on `npm install`
- Old files are cleaned up when plugins are updated or removed
- You can see what's installed at a glance

## Troubleshooting

### Assets not copied

Run the install command manually:

```bash
npx claude-plugins install
```

### Skills not showing in Claude Code

Check that `.claude/` directories exist and contain files:

```bash
ls -la .claude/skills/
ls -la .claude/commands/
ls -la .claude/agents/
ls -la .claude/hooks/
```

### Plugin not detected

Verify the plugin's package.json has:
- `claude-manager` as a dependency
- A `postinstall` script that calls `claude-plugins add`
- A `skills/`, `commands/`, `agents/`, or `hooks/` directory with content

### Postinstall hook not added

If your project's `package.json` doesn't have the postinstall hook, add it manually:

```json
{
  "scripts": {
    "postinstall": "claude-plugins install"
  }
}
```

## Requirements

- Node.js >= 18.0.0
- npm, pnpm, or yarn

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
