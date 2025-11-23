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
        $extra = $package->getExtra()['claude-plugin'] ?? [];

        // Create .claude directory if it doesn't exist
        if (! $this->files->exists($this->claudeDir)) {
            $this->files->mkdir($this->claudeDir, 0755);
        }

        // Install skills
        if (isset($extra['skills'])) {
            $this->installSkills($packagePath, $extra['skills']);
        }

        // Install commands
        if (isset($extra['commands'])) {
            $this->installCommands($packagePath, $extra['commands']);
        }

        // Update gitignore
        $this->updateGitignore();
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

    private function installSkills(string $packagePath, array $skills): void
    {
        $skillsDir = $this->claudeDir.'/skills';

        if (! $this->files->exists($skillsDir)) {
            $this->files->mkdir($skillsDir, 0755);
        }

        foreach ($skills as $skill) {
            $source = $packagePath.'/'.$skill;

            if (! $this->files->exists($source)) {
                if ($this->io) {
                    $this->io->write(
                        sprintf('    <warning>Skill not found: %s</warning>', $skill)
                    );
                }

                continue;
            }

            // Get the skill directory name (e.g., 'laravel-conventions')
            $skillName = basename($skill);
            $target = $skillsDir.'/'.$skillName;

            // Remove existing symlink/directory
            if ($this->files->exists($target)) {
                if (is_link($target)) {
                    unlink($target);
                } else {
                    $this->files->remove($target);
                }
            }

            // Create symlink
            $this->files->symlink($source, $target);
        }
    }

    private function installCommands(string $packagePath, array $commands): void
    {
        $commandsDir = $this->claudeDir.'/commands';

        if (! $this->files->exists($commandsDir)) {
            $this->files->mkdir($commandsDir, 0755);
        }

        foreach ($commands as $command) {
            $source = $packagePath.'/'.$command;

            if (! $this->files->exists($source)) {
                if ($this->io) {
                    $this->io->write(
                        sprintf('    <warning>Command not found: %s</warning>', $command)
                    );
                }

                continue;
            }

            $target = $commandsDir.'/'.basename($command);

            // Remove existing symlink/file
            if ($this->files->exists($target)) {
                if (is_link($target)) {
                    unlink($target);
                } else {
                    $this->files->remove($target);
                }
            }

            // Create symlink
            $this->files->symlink($source, $target);
        }
    }

    private function updateGitignore(): void
    {
        $gitignorePath = dirname($this->vendorDir).'/.gitignore';
        $marker = '# Claude plugins (managed by Composer)';
        $patterns = [
            '/.claude/skills/*/',
            '/.claude/commands/*.md',
        ];

        // Read existing content or start fresh
        $content = '';
        $lineEnding = "\n";

        if (file_exists($gitignorePath)) {
            if (! is_readable($gitignorePath)) {
                if ($this->io) {
                    $this->io->write(
                        '<warning>Could not update .gitignore (file not readable)</warning>'
                    );
                }

                return;
            }

            $content = file_get_contents($gitignorePath);

            // Detect line endings
            if (str_contains($content, "\r\n")) {
                $lineEnding = "\r\n";
            }

            // Check if our section exists
            if (str_contains($content, $marker)) {
                return; // Already added
            }
        }

        // Build our section
        $section = $lineEnding.$marker.$lineEnding;
        foreach ($patterns as $pattern) {
            $section .= $pattern.$lineEnding;
        }

        // Append to existing content
        $newContent = $content.$section;

        // Write back
        try {
            file_put_contents($gitignorePath, $newContent);
        } catch (Exception $e) {
            if ($this->io) {
                $this->io->write(
                    '<warning>Could not update .gitignore: '.$e->getMessage().'</warning>'
                );
            }
        }
    }
}
