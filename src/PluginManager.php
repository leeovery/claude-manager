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

        // Update gitignore with specific installed items
        $this->updateGitignore($installedItems);
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

        return $plugins;
    }

    private function autoDiscoverSkills(string $skillsPath): array
    {
        return $this->symlinkItems($skillsPath, 'skills', fn ($item) => $item->isDir());
    }

    private function symlinkItems(string $sourcePath, string $type, callable $filter): array
    {
        $targetDir = $this->claudeDir.'/'.$type;
        $installed = [];

        if (! $this->files->exists($targetDir)) {
            $this->files->mkdir($targetDir, 0755);
        }

        $iterator = new DirectoryIterator($sourcePath);

        foreach ($iterator as $item) {
            if ($item->isDot() || ! $filter($item)) {
                continue;
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

    private function updateGitignore(array $installedItems): void
    {
        if (empty($installedItems)) {
            return;
        }

        $gitignorePath = dirname($this->vendorDir).'/.gitignore';
        $marker = '# Claude plugins (managed by Composer)';

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
        }

        // Build patterns for installed items
        $patterns = [];
        foreach ($installedItems as $item) {
            if ($item['type'] === 'skills') {
                $patterns[] = '/.claude/skills/'.$item['name'];
            } elseif ($item['type'] === 'commands') {
                $patterns[] = '/.claude/commands/'.$item['name'];
            }
        }

        // Check if patterns already exist
        $newPatterns = [];
        foreach ($patterns as $pattern) {
            if (! str_contains($content, $pattern)) {
                $newPatterns[] = $pattern;
            }
        }

        if (empty($newPatterns)) {
            return; // Nothing to add
        }

        // Add marker if not present
        if (! str_contains($content, $marker)) {
            $content .= $lineEnding.$marker.$lineEnding;
        }

        // Append new patterns
        foreach ($newPatterns as $pattern) {
            $content .= $pattern.$lineEnding;
        }

        // Write back
        try {
            file_put_contents($gitignorePath, $content);
        } catch (Exception $e) {
            $this->io?->write(
                '<warning>Could not update .gitignore: '.$e->getMessage().'</warning>'
            );
        }
    }
}
