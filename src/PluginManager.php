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
    private Filesystem $files;

    private string $claudeDir;

    private string $vendorDir;

    private ?IOInterface $io;

    public function __construct(string $claudeDir, string $vendorDir, ?IOInterface $io = null)
    {
        $this->files = new Filesystem();
        $this->claudeDir = $claudeDir;
        $this->vendorDir = $vendorDir;
        $this->io = $io;
    }

    public function installFromPackage(PackageInterface $package): void
    {
        $packagePath = $this->vendorDir.'/'.$package->getName();

        // Create .claude directory if it doesn't exist
        if (! $this->files->exists($this->claudeDir)) {
            $this->files->mkdir($this->claudeDir, 0755);
        }

        // Clean up old symlinks for this package before installing new ones
        $this->cleanupPackageSymlinks($package->getName());

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

        // Update gitignore with specific installed items
        $this->updateGitignore($package->getName(), $installedItems);
    }

    public function list(): array
    {
        $plugins = [];

        if (! $this->files->exists($this->claudeDir)) {
            return $plugins;
        }

        // List skills
        if ($this->files->exists($this->claudeDir.'/skills')) {
            $skillsIterator = new DirectoryIterator($this->claudeDir.'/skills');

            foreach ($skillsIterator as $item) {
                if ($item->isDot()) {
                    continue;
                }

                $skillPath = $item->getPathname();

                if (is_link($skillPath)) {
                    $target = readlink($skillPath);
                    $plugins[] = [
                        'name' => $item->getFilename(),
                        'path' => $target,
                        'type' => 'skill',
                    ];
                }
            }
        }

        // List commands
        if ($this->files->exists($this->claudeDir.'/commands')) {
            $commandsIterator = new DirectoryIterator($this->claudeDir.'/commands');

            foreach ($commandsIterator as $item) {
                if ($item->isDot() || ! $item->isFile()) {
                    continue;
                }

                $commandPath = $item->getPathname();

                if (is_link($commandPath)) {
                    $target = readlink($commandPath);
                    $plugins[] = [
                        'name' => $item->getFilename(),
                        'path' => $target,
                        'type' => 'command',
                    ];
                }
            }
        }

        // List agents
        if ($this->files->exists($this->claudeDir.'/agents')) {
            $agentsIterator = new DirectoryIterator($this->claudeDir.'/agents');

            foreach ($agentsIterator as $item) {
                if ($item->isDot() || ! $item->isFile()) {
                    continue;
                }

                $agentPath = $item->getPathname();

                if (is_link($agentPath)) {
                    $target = readlink($agentPath);
                    $plugins[] = [
                        'name' => $item->getFilename(),
                        'path' => $target,
                        'type' => 'agent',
                    ];
                }
            }
        }

        // List hooks
        if ($this->files->exists($this->claudeDir.'/hooks')) {
            $hooksIterator = new DirectoryIterator($this->claudeDir.'/hooks');

            foreach ($hooksIterator as $item) {
                if ($item->isDot() || ! $item->isFile()) {
                    continue;
                }

                $hookPath = $item->getPathname();

                if (is_link($hookPath)) {
                    $target = readlink($hookPath);
                    $plugins[] = [
                        'name' => $item->getFilename(),
                        'path' => $target,
                        'type' => 'hook',
                    ];
                }
            }
        }

        return $plugins;
    }

    private function cleanupPackageSymlinks(string $packageName): void
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

                // Only process symlinks
                if (! is_link($path)) {
                    continue;
                }

                // Get the symlink target
                $target = readlink($path);

                // If the target points to this package's vendor directory, remove it
                if ($target && str_contains($target, $this->vendorDir.'/'.$packageName.'/')) {
                    unlink($path);
                }
            }
        }
    }

    private function autoDiscoverSkills(string $skillsPath): array
    {
        return $this->symlinkItems($skillsPath, 'skills', fn ($item) => $item->isDir());
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
        return $this->symlinkItems($commandsPath, 'commands', fn ($item) => $item->isFile());
    }

    private function autoDiscoverAgents(string $agentsPath): array
    {
        return $this->symlinkItems($agentsPath, 'agents', fn ($item) => $item->isFile());
    }

    private function autoDiscoverHooks(string $hooksPath): array
    {
        return $this->symlinkItems($hooksPath, 'hooks', fn ($item) => $item->isFile());
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
}
