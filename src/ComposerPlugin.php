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
        $this->io->write('<info>Installing Claude Code plugins...</info>');

        $vendorDir = $this->composer->getConfig()->get('vendor-dir');
        $baseDir = dirname($vendorDir);
        $claudeDir = $baseDir.'/.claude';

        $manager = new PluginManager($claudeDir, $vendorDir, $this->io);

        // Find all installed claude-plugin packages
        $packages = $this->composer->getRepositoryManager()
            ->getLocalRepository()
            ->getPackages();

        $installedCount = 0;

        foreach ($packages as $package) {
            if ($package->getType() === 'claude-plugin') {
                $this->io->write(
                    sprintf('  <comment>→</comment> Installing <info>%s</info>', $package->getName())
                );

                $manager->installFromPackage($package);
                $installedCount++;
            }
        }

        if ($installedCount > 0) {
            $this->io->write(
                sprintf(
                    '<info>✓ Installed %d Claude plugin%s successfully!</info>',
                    $installedCount,
                    $installedCount === 1 ? '' : 's'
                )
            );
        } else {
            $this->io->write('<comment>No Claude plugins found.</comment>');
        }
    }
}
