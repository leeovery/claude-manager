<?php

declare(strict_types=1);

namespace LeeOvery\ClaudeManager;

use Composer\IO\IOInterface;
use Composer\Package\PackageInterface;
use DirectoryIterator;
use Exception;
use Symfony\Component\Filesystem\Filesystem;

class PluginManager
{
    public const MODE_SYMLINK = 'symlink';

    public const MODE_COPY = 'copy';

    private const MANIFEST_FILE = '.claude-manager.json';

    private Filesystem $files;

    private string $claudeDir;

    private string $vendorDir;

    private ?IOInterface $io;

    private string $mode;

    private array $installedPaths = [];

    public function __construct(string $claudeDir, string $vendorDir, ?IOInterface $io = null, ?string $mode = null)
    {
        $this->files = new Filesystem();
        $this->claudeDir = $claudeDir;
        $this->vendorDir = $vendorDir;
        $this->io = $io;
        $this->mode = $mode ?? $this->readModeFromComposer() ?? self::MODE_SYMLINK;
    }

    public static function readModeFromComposerJson(string $composerJsonPath): ?string
    {
        if (! file_exists($composerJsonPath)) {
            return null;
        }

        $content = file_get_contents($composerJsonPath);
        $data = json_decode($content, true);

        return $data['extra']['claude-manager']['mode'] ?? null;
    }

    public static function writeModeToComposerJson(string $composerJsonPath, string $mode): bool
    {
        if (! file_exists($composerJsonPath)) {
            return false;
        }

        $content = file_get_contents($composerJsonPath);
        $data = json_decode($content, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            return false;
        }

        if (! isset($data['extra'])) {
            $data['extra'] = [];
        }

        if (! isset($data['extra']['claude-manager'])) {
            $data['extra']['claude-manager'] = [];
        }

        $data['extra']['claude-manager']['mode'] = $mode;

        $newContent = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n";

        return file_put_contents($composerJsonPath, $newContent) !== false;
    }

    public function getMode(): string
    {
        return $this->mode;
    }

    public function prepareInstall(): void
    {
        if ($this->mode === self::MODE_COPY) {
            $this->cleanupFromManifest();
        }
    }

    public function uninstallPackage(string $packageName): void
    {
        $packagePath = $this->vendorDir.'/'.$packageName;
        $types = ['skills', 'commands', 'agents', 'hooks'];

        // Remove symlinks pointing to this package
        $this->cleanupSymlinksForPackage($packageName);

        // Remove copied files (scan vendor package to find what to remove)
        foreach ($types as $type) {
            $sourceDir = $packagePath.'/'.$type;
            $targetDir = $this->claudeDir.'/'.$type;

            if (! is_dir($sourceDir) || ! is_dir($targetDir)) {
                continue;
            }

            $iterator = new DirectoryIterator($sourceDir);
            foreach ($iterator as $item) {
                if ($item->isDot() || $item->getFilename() === '.gitkeep') {
                    continue;
                }

                $targetPath = $targetDir.'/'.$item->getFilename();
                if ($this->files->exists($targetPath) && ! is_link($targetPath)) {
                    $this->files->remove($targetPath);
                }
            }
        }

        // Remove gitignore entries
        $this->removeGitignoreEntriesForPackage($packageName);
    }

    public function installFromPackage(PackageInterface $package): void
    {
        $packagePath = $this->vendorDir.'/'.$package->getName();

        // Create .claude directory if it doesn't exist
        if (! $this->files->exists($this->claudeDir)) {
            $this->files->mkdir($this->claudeDir, 0755);
        }

        // Clean up old assets for this package before installing new ones
        // In copy mode, cleanup is handled by prepareInstall() via manifest
        if ($this->mode === self::MODE_SYMLINK) {
            $this->cleanupSymlinksForPackage($package->getName());
        }

        $installedItems = [];

        // Auto-discover and install skills
        $skillsPath = $packagePath.'/skills';
        if ($this->files->exists($skillsPath)) {
            $installedItems = array_merge($installedItems, $this->autoDiscoverSkills($skillsPath));
        }

        // Auto-discover and install commands
        $commandsPath = $packagePath.'/commands';
        if ($this->files->exists($commandsPath)) {
            $installedItems = array_merge($installedItems, $this->autoDiscoverCommands($commandsPath));
        }

        // Auto-discover and install agents
        $agentsPath = $packagePath.'/agents';
        if ($this->files->exists($agentsPath)) {
            $installedItems = array_merge($installedItems, $this->autoDiscoverAgents($agentsPath));
        }

        // Auto-discover and install hooks
        $hooksPath = $packagePath.'/hooks';
        if ($this->files->exists($hooksPath)) {
            $installedItems = array_merge($installedItems, $this->autoDiscoverHooks($hooksPath));
        }

        // Only update gitignore in symlink mode
        if ($this->mode === self::MODE_SYMLINK) {
            $this->updateGitignore($package->getName(), $installedItems);
        } else {
            // In copy mode, remove any existing gitignore entries for this package
            $this->removeGitignoreEntriesForPackage($package->getName());
        }
    }

    public function list(): array
    {
        $plugins = [];

        if (! $this->files->exists($this->claudeDir)) {
            return $plugins;
        }

        // List skills (directories)
        if ($this->files->exists($this->claudeDir.'/skills')) {
            $skillsIterator = new DirectoryIterator($this->claudeDir.'/skills');

            foreach ($skillsIterator as $item) {
                if ($item->isDot()) {
                    continue;
                }

                $skillPath = $item->getPathname();

                if (is_link($skillPath)) {
                    $plugins[] = [
                        'name' => $item->getFilename(),
                        'path' => readlink($skillPath),
                        'type' => 'skill',
                        'mode' => 'symlink',
                    ];
                } elseif ($item->isDir()) {
                    $plugins[] = [
                        'name' => $item->getFilename(),
                        'path' => $skillPath,
                        'type' => 'skill',
                        'mode' => 'copy',
                    ];
                }
            }
        }

        // List commands (files)
        if ($this->files->exists($this->claudeDir.'/commands')) {
            $commandsIterator = new DirectoryIterator($this->claudeDir.'/commands');

            foreach ($commandsIterator as $item) {
                if ($item->isDot()) {
                    continue;
                }

                $commandPath = $item->getPathname();

                if (is_link($commandPath)) {
                    $plugins[] = [
                        'name' => $item->getFilename(),
                        'path' => readlink($commandPath),
                        'type' => 'command',
                        'mode' => 'symlink',
                    ];
                } elseif ($item->isFile()) {
                    $plugins[] = [
                        'name' => $item->getFilename(),
                        'path' => $commandPath,
                        'type' => 'command',
                        'mode' => 'copy',
                    ];
                }
            }
        }

        // List agents (files)
        if ($this->files->exists($this->claudeDir.'/agents')) {
            $agentsIterator = new DirectoryIterator($this->claudeDir.'/agents');

            foreach ($agentsIterator as $item) {
                if ($item->isDot()) {
                    continue;
                }

                $agentPath = $item->getPathname();

                if (is_link($agentPath)) {
                    $plugins[] = [
                        'name' => $item->getFilename(),
                        'path' => readlink($agentPath),
                        'type' => 'agent',
                        'mode' => 'symlink',
                    ];
                } elseif ($item->isFile()) {
                    $plugins[] = [
                        'name' => $item->getFilename(),
                        'path' => $agentPath,
                        'type' => 'agent',
                        'mode' => 'copy',
                    ];
                }
            }
        }

        // List hooks (files)
        if ($this->files->exists($this->claudeDir.'/hooks')) {
            $hooksIterator = new DirectoryIterator($this->claudeDir.'/hooks');

            foreach ($hooksIterator as $item) {
                if ($item->isDot()) {
                    continue;
                }

                $hookPath = $item->getPathname();

                if (is_link($hookPath)) {
                    $plugins[] = [
                        'name' => $item->getFilename(),
                        'path' => readlink($hookPath),
                        'type' => 'hook',
                        'mode' => 'symlink',
                    ];
                } elseif ($item->isFile()) {
                    $plugins[] = [
                        'name' => $item->getFilename(),
                        'path' => $hookPath,
                        'type' => 'hook',
                        'mode' => 'copy',
                    ];
                }
            }
        }

        return $plugins;
    }

    public function removeAllGitignoreEntries(): void
    {
        $gitignorePath = dirname($this->vendorDir).'/.gitignore';

        if (! file_exists($gitignorePath)) {
            return;
        }

        $content = file_get_contents($gitignorePath);
        $lineEnding = str_contains($content, "\r\n") ? "\r\n" : "\n";

        // Find and remove all Claude plugin sections
        $pattern = '/' . preg_quote($lineEnding, '/') . '?# Claude plugins: [^\s]+ \(start\)' .
            '.*?' .
            '# Claude plugins: [^\s]+ \(end\)' . preg_quote($lineEnding, '/') . '?/s';

        $newContent = preg_replace($pattern, '', $content);

        // Clean up any double blank lines that might result
        $newContent = preg_replace('/(' . preg_quote($lineEnding, '/') . '){3,}/', $lineEnding.$lineEnding, $newContent);

        if ($newContent !== $content) {
            file_put_contents($gitignorePath, $newContent);
            $this->io?->write('<info>Removed Claude plugin entries from .gitignore</info>');
        }
    }

    public function cleanupAllAssets(): void
    {
        // Clean up from manifest (for copy mode assets)
        $this->cleanupFromManifest();

        // Clean up symlinks
        $types = ['skills', 'commands', 'agents', 'hooks'];

        foreach ($types as $type) {
            $dir = $this->claudeDir.'/'.$type;

            if (! $this->files->exists($dir)) {
                continue;
            }

            $iterator = new DirectoryIterator($dir);

            foreach ($iterator as $item) {
                if ($item->isDot()) {
                    continue;
                }

                $path = $item->getPathname();

                // Remove symlinks
                if (is_link($path)) {
                    unlink($path);
                }
            }
        }
    }

    private function readModeFromComposer(): ?string
    {
        $composerJsonPath = dirname($this->vendorDir).'/composer.json';

        return self::readModeFromComposerJson($composerJsonPath);
    }

    private function cleanupSymlinksForPackage(string $packageName): void
    {
        $types = ['skills', 'commands', 'agents', 'hooks'];

        foreach ($types as $type) {
            $dir = $this->claudeDir.'/'.$type;

            if (! $this->files->exists($dir)) {
                continue;
            }

            $iterator = new DirectoryIterator($dir);

            foreach ($iterator as $item) {
                if ($item->isDot()) {
                    continue;
                }

                $path = $item->getPathname();

                // Only handle symlinks - check if target points to this package
                if (is_link($path)) {
                    $target = readlink($path);
                    if ($target && str_contains($target, $this->vendorDir.'/'.$packageName.'/')) {
                        unlink($path);
                    }
                }
            }
        }
    }

    private function getManifestPath(): string
    {
        return $this->claudeDir.'/'.self::MANIFEST_FILE;
    }

    private function readManifest(): array
    {
        $path = $this->getManifestPath();

        if (! file_exists($path)) {
            return ['installed' => []];
        }

        $content = file_get_contents($path);
        $data = json_decode($content, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            return ['installed' => []];
        }

        return $data;
    }

    private function writeManifest(): void
    {
        $path = $this->getManifestPath();

        // Ensure .claude directory exists
        if (! $this->files->exists($this->claudeDir)) {
            $this->files->mkdir($this->claudeDir, 0755);
        }

        $data = ['installed' => array_values(array_unique($this->installedPaths))];
        sort($data['installed']);

        file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n");
    }

    private function cleanupFromManifest(): void
    {
        $manifest = $this->readManifest();

        foreach ($manifest['installed'] ?? [] as $relativePath) {
            $fullPath = $this->claudeDir.'/'.$relativePath;

            if ($this->files->exists($fullPath)) {
                $this->files->remove($fullPath);
            }
        }

        // Clear manifest and in-memory tracking
        $this->installedPaths = [];
        $manifestPath = $this->getManifestPath();
        if (file_exists($manifestPath)) {
            $this->files->remove($manifestPath);
        }
    }

    private function addToManifest(string $type, string $name): void
    {
        $this->installedPaths[] = $type.'/'.$name;
        $this->writeManifest();
    }

    private function autoDiscoverSkills(string $skillsPath): array
    {
        return $this->installItems($skillsPath, 'skills', fn ($item) => $item->isDir());
    }

    private function symlinkItems(string $sourcePath, string $type, callable $filter): array
    {
        $targetDir = $this->claudeDir.'/'.$type;
        $installed = [];

        $iterator = new DirectoryIterator($sourcePath);

        foreach ($iterator as $item) {
            if ($item->isDot() || ! $filter($item)) {
                continue;
            }

            // Skip .gitkeep files
            if ($item->getFilename() === '.gitkeep') {
                continue;
            }

            // Create target directory only if we have items to install
            if (! $this->files->exists($targetDir)) {
                $this->files->mkdir($targetDir, 0755);
            }

            $source = $item->getPathname();
            $target = $targetDir.'/'.$item->getFilename();

            if ($this->files->exists($target)) {
                if (is_link($target)) {
                    unlink($target);
                } else {
                    $this->files->remove($target);
                }
            }

            $this->files->symlink($source, $target);
            $installed[] = ['type' => $type, 'name' => $item->getFilename()];
        }

        return $installed;
    }

    private function autoDiscoverCommands(string $commandsPath): array
    {
        return $this->installItems($commandsPath, 'commands', fn ($item) => $item->isFile());
    }

    private function autoDiscoverAgents(string $agentsPath): array
    {
        return $this->installItems($agentsPath, 'agents', fn ($item) => $item->isFile());
    }

    private function autoDiscoverHooks(string $hooksPath): array
    {
        return $this->installItems($hooksPath, 'hooks', fn ($item) => $item->isFile());
    }

    private function installItems(string $sourcePath, string $type, callable $filter): array
    {
        if ($this->mode === self::MODE_COPY) {
            return $this->copyItems($sourcePath, $type, $filter);
        }

        return $this->symlinkItems($sourcePath, $type, $filter);
    }

    private function copyItems(string $sourcePath, string $type, callable $filter): array
    {
        $targetDir = $this->claudeDir.'/'.$type;
        $installed = [];

        $iterator = new DirectoryIterator($sourcePath);

        foreach ($iterator as $item) {
            if ($item->isDot() || ! $filter($item)) {
                continue;
            }

            // Skip .gitkeep files
            if ($item->getFilename() === '.gitkeep') {
                continue;
            }

            // Create target directory only if we have items to install
            if (! $this->files->exists($targetDir)) {
                $this->files->mkdir($targetDir, 0755);
            }

            $source = $item->getPathname();
            $target = $targetDir.'/'.$item->getFilename();

            // Remove existing target (symlink or file/directory)
            if ($this->files->exists($target) || is_link($target)) {
                if (is_link($target)) {
                    unlink($target);
                } else {
                    $this->files->remove($target);
                }
            }

            // Copy file or directory
            if ($item->isDir()) {
                $this->files->mirror($source, $target);
            } else {
                $this->files->copy($source, $target);
            }

            // Track in manifest
            $this->addToManifest($type, $item->getFilename());

            $installed[] = ['type' => $type, 'name' => $item->getFilename()];
        }

        return $installed;
    }

    private function updateGitignore(string $packageName, array $installedItems): void
    {
        $gitignorePath = dirname($this->vendorDir).'/.gitignore';
        $startMarker = "# Claude plugins: {$packageName} (start)";
        $endMarker = "# Claude plugins: {$packageName} (end)";

        // Read existing content or start fresh
        $content = '';
        $lineEnding = "\n";

        if (file_exists($gitignorePath)) {
            if (! is_readable($gitignorePath)) {
                $this->io?->write(
                    '<warning>Could not update .gitignore (file not readable)</warning>'
                );

                return;
            }

            $content = file_get_contents($gitignorePath);

            // Detect line endings
            if (str_contains($content, "\r\n")) {
                $lineEnding = "\r\n";
            }

            // Remove existing section for this package
            $content = $this->removeGitignoreSection($content, $startMarker, $endMarker, $lineEnding);
        }

        // If there are no items to install, we're done (cleanup only)
        if (empty($installedItems)) {
            try {
                file_put_contents($gitignorePath, $content);
                $this->sortGitignoreSections($gitignorePath, $lineEnding);
            } catch (Exception $e) {
                $this->io?->write(
                    '<warning>Could not update .gitignore: '.$e->getMessage().'</warning>'
                );
            }

            return;
        }

        // Build patterns for installed items
        $patterns = [];
        foreach ($installedItems as $item) {
            if ($item['type'] === 'skills') {
                $patterns[] = '/.claude/skills/'.$item['name'];
            } elseif ($item['type'] === 'commands') {
                $patterns[] = '/.claude/commands/'.$item['name'];
            } elseif ($item['type'] === 'agents') {
                $patterns[] = '/.claude/agents/'.$item['name'];
            } elseif ($item['type'] === 'hooks') {
                $patterns[] = '/.claude/hooks/'.$item['name'];
            }
        }

        // Sort patterns alphabetically for deterministic output
        sort($patterns);

        // Add new section at the end
        if (! empty($content) && ! str_ends_with($content, $lineEnding)) {
            $content .= $lineEnding;
        }

        $content .= $lineEnding.$startMarker.$lineEnding;
        foreach ($patterns as $pattern) {
            $content .= $pattern.$lineEnding;
        }
        $content .= $endMarker.$lineEnding;

        // Write back and sort all sections
        try {
            file_put_contents($gitignorePath, $content);
            $this->sortGitignoreSections($gitignorePath, $lineEnding);
        } catch (Exception $e) {
            $this->io?->write(
                '<warning>Could not update .gitignore: '.$e->getMessage().'</warning>'
            );
        }
    }

    private function sortGitignoreSections(string $gitignorePath, string $lineEnding): void
    {
        $content = file_get_contents($gitignorePath);

        // Extract all Claude plugin sections
        $sectionPattern = '/' . preg_quote($lineEnding, '/') . '# Claude plugins: ([^\s]+) \(start\)' .
            '(.*?)' .
            '# Claude plugins: [^\s]+ \(end\)' . preg_quote($lineEnding, '/') . '/s';

        preg_match_all($sectionPattern, $content, $matches, PREG_SET_ORDER);

        if (count($matches) < 2) {
            return; // Nothing to sort
        }

        // Remove all sections from content
        $contentWithoutSections = $content;
        foreach ($matches as $match) {
            $contentWithoutSections = str_replace($match[0], '', $contentWithoutSections);
        }

        // Sort sections by package name (second part after the slash)
        usort($matches, function ($a, $b) {
            $nameA = $this->extractPackageSortKey($a[1]);
            $nameB = $this->extractPackageSortKey($b[1]);

            return strcasecmp($nameA, $nameB);
        });

        // Rebuild content with sorted sections
        $result = mb_rtrim($contentWithoutSections, $lineEnding);
        if (! empty($result)) {
            $result .= $lineEnding;
        }

        foreach ($matches as $match) {
            $result .= $match[0];
        }

        file_put_contents($gitignorePath, $result);
    }

    private function extractPackageSortKey(string $packageName): string
    {
        // Extract the second part of the package name (e.g., "skill-name" from "vendor/skill-name")
        $parts = explode('/', $packageName);

        return count($parts) > 1 ? $parts[1] : $packageName;
    }

    private function removeGitignoreSection(string $content, string $startMarker, string $endMarker, string $lineEnding): string
    {
        $startPos = mb_strpos($content, $startMarker);
        if ($startPos === false) {
            return $content; // No section to remove
        }

        // Find the end marker after the start marker
        $endPos = mb_strpos($content, $endMarker, $startPos);
        if ($endPos === false) {
            return $content; // Malformed section, leave it alone
        }

        // Calculate the length to remove (include the end marker line)
        $endOfEndMarker = mb_strpos($content, $lineEnding, $endPos);
        if ($endOfEndMarker === false) {
            $endOfEndMarker = mb_strlen($content);
        } else {
            $endOfEndMarker += mb_strlen($lineEnding);
        }

        // If there's a blank line before the start marker, remove it too
        $removeFrom = $startPos;
        if ($startPos > 0 && mb_substr($content, $startPos - mb_strlen($lineEnding), mb_strlen($lineEnding)) === $lineEnding) {
            $removeFrom -= mb_strlen($lineEnding);
        }

        // Remove the section
        return mb_substr($content, 0, $removeFrom).mb_substr($content, $endOfEndMarker);
    }

    private function removeGitignoreEntriesForPackage(string $packageName): void
    {
        $gitignorePath = dirname($this->vendorDir).'/.gitignore';

        if (! file_exists($gitignorePath)) {
            return;
        }

        $content = file_get_contents($gitignorePath);
        $lineEnding = str_contains($content, "\r\n") ? "\r\n" : "\n";

        $startMarker = "# Claude plugins: {$packageName} (start)";
        $endMarker = "# Claude plugins: {$packageName} (end)";

        $newContent = $this->removeGitignoreSection($content, $startMarker, $endMarker, $lineEnding);

        if ($newContent !== $content) {
            file_put_contents($gitignorePath, $newContent);
        }
    }
}
