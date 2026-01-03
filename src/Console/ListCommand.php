<?php

declare(strict_types=1);

namespace LeeOvery\ClaudeManager\Console;

use LeeOvery\ClaudeManager\PluginManager;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Helper\Table;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

use function count;
use function getcwd;
use function sprintf;

#[AsCommand(
    name: 'list',
    description: 'List installed Claude Code plugins'
)]
class ListCommand extends Command
{
    protected function configure(): void
    {
        $this->setHelp('Shows all installed skills, commands, agents, and hooks');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $claudeDir = getcwd().'/.claude';
        $vendorDir = getcwd().'/vendor';

        $manager = new PluginManager($claudeDir, $vendorDir);
        $plugins = $manager->list();

        if (count($plugins) === 0) {
            $output->writeln('<info>No Claude Code plugins installed.</info>');
            $output->writeln('');
            $output->writeln('Add a plugin package to your composer.json:');
            $output->writeln('  composer require --dev leeovery/claude-laravel');

            return Command::SUCCESS;
        }

        $skillsCount = count(array_filter($plugins, fn ($p) => $p['type'] === 'skill'));
        $commandsCount = count(array_filter($plugins, fn ($p) => $p['type'] === 'command'));
        $agentsCount = count(array_filter($plugins, fn ($p) => $p['type'] === 'agent'));
        $hooksCount = count(array_filter($plugins, fn ($p) => $p['type'] === 'hook'));

        $output->writeln(sprintf(
            '<info>Found %d skill%s, %d command%s, %d agent%s, and %d hook%s:</info>',
            $skillsCount,
            $skillsCount === 1 ? '' : 's',
            $commandsCount,
            $commandsCount === 1 ? '' : 's',
            $agentsCount,
            $agentsCount === 1 ? '' : 's',
            $hooksCount,
            $hooksCount === 1 ? '' : 's'
        ));
        $output->writeln('');

        $table = new Table($output);
        $table->setHeaders(['Name', 'Type', 'Mode', 'Source Path']);

        foreach ($plugins as $plugin) {
            $table->addRow([
                $plugin['name'],
                $plugin['type'],
                $plugin['mode'] ?? 'symlink',
                $plugin['path'],
            ]);
        }

        $table->render();

        return Command::SUCCESS;
    }
}
