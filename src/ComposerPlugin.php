<?php

declare(strict_types=1);

namespace LeeOvery\ClaudeManager;

use Composer\Composer;
use Composer\EventDispatcher\EventSubscriberInterface;
use Composer\IO\IOInterface;
use Composer\Plugin\PluginInterface;
use Composer\Script\Event;

class ComposerPlugin implements EventSubscriberInterface, PluginInterface
{
    private ?Composer $composer = null;

    private ?IOInterface $io = null;

    public static function getSubscribedEvents(): array
    {
        return [
            'post-install-cmd' => 'installPlugins',
            'post-update-cmd' => 'installPlugins',
        ];
    }

    public function activate(Composer $composer, IOInterface $io): void
    {
        $this->composer = $composer;
        $this->io = $io;
    }

    public function deactivate(Composer $composer, IOInterface $io): void
    {
        // Not needed
    }

    public function uninstall(Composer $composer, IOInterface $io): void
    {
        // Not needed
    }

    public function installPlugins(Event $event): void
    {
        $this->io->write('');
        $this->io->write('<info>Installing Claude Code plugins...</info>');

        $vendorDir = $this->composer->getConfig()->get('vendor-dir');
        $baseDir = dirname($vendorDir);
        $claudeDir = $baseDir.'/.claude';
        $composerJsonPath = $baseDir.'/composer.json';

        // Check if mode is already configured
        $configuredMode = PluginManager::readModeFromComposerJson($composerJsonPath);

        // If no mode configured and we're in interactive mode, prompt user
        if ($configuredMode === null && $this->io->isInteractive()) {
            $configuredMode = $this->promptForMode($composerJsonPath);
        }

        $manager = new PluginManager($claudeDir, $vendorDir, $this->io, $configuredMode);

        // Find all installed claude-plugin packages
        $packages = $this->composer->getRepositoryManager()
            ->getLocalRepository()
            ->getPackages();

        $pluginPackages = [];
        foreach ($packages as $package) {
            if ($package->getType() === 'claude-plugin') {
                $pluginPackages[] = $package;
            }
        }

        if (empty($pluginPackages)) {
            $this->io->write('<comment>No Claude plugins found</comment>');
            $this->io->write('');

            return;
        }

        // Prepare for installation (cleans up manifest-tracked assets in copy mode)
        $manager->prepareInstall();

        // Find longest package name for alignment
        $maxLength = 0;
        foreach ($pluginPackages as $package) {
            $maxLength = max($maxLength, mb_strlen($package->getName()));
        }

        // Install each plugin
        foreach ($pluginPackages as $package) {
            $name = mb_str_pad($package->getName(), $maxLength);
            $this->io->write(
                sprintf('  <comment>→</comment> <info>%s</info>', $name)
            );

            $manager->installFromPackage($package);
        }

        $this->io->write(
            sprintf(
                '<info>✓ Installed %d plugin%s</info>',
                count($pluginPackages),
                count($pluginPackages) === 1 ? '' : 's'
            )
        );

        $this->io->write('');
    }

    private function promptForMode(string $composerJsonPath): ?string
    {
        $this->io->write('');
        $this->io->write('<comment>Choose installation mode for Claude plugins:</comment>');
        $this->io->write('');
        $this->io->write('  <info>[1] symlink</info> - Creates symlinks to vendor packages (default)');
        $this->io->write('                Assets are gitignored');
        $this->io->write('');
        $this->io->write('  <info>[2] copy</info>    - Copies files from vendor packages');
        $this->io->write('                Assets are added to git');
        $this->io->write('                Recommended for Claude Code on the web');
        $this->io->write('');

        $answer = $this->io->ask('<info>Select mode [1]:</info> ', '1');
        $answer = mb_trim($answer);

        $mode = match ($answer) {
            '2', 'copy' => PluginManager::MODE_COPY,
            default => PluginManager::MODE_SYMLINK,
        };

        // Save selection to composer.json
        if (PluginManager::writeModeToComposerJson($composerJsonPath, $mode)) {
            $this->io->write('');
            $this->io->write(sprintf('<info>Mode set to "%s" and saved to composer.json</info>', $mode));
        }

        $this->io->write('');

        return $mode;
    }
}
