<?php

declare(strict_types=1);

namespace LeeOvery\ClaudeManager\Console;

use LeeOvery\ClaudeManager\PluginManager;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Helper\Table;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

use function count;
use function getcwd;
use function sprintf;

class ListCommand extends Command
{
    protected static $defaultName = 'list';

    protected function configure(): void
    {
        $this
            ->setDescription('List installed Claude Code plugins')
            ->setHelp('Shows all installed skills and commands');
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

        $output->writeln(sprintf(
            '<info>Found %d skill%s and %d command%s:</info>',
            $skillsCount,
            $skillsCount === 1 ? '' : 's',
            $commandsCount,
            $commandsCount === 1 ? '' : 's'
        ));
        $output->writeln('');

        $table = new Table($output);
        $table->setHeaders(['Name', 'Type', 'Source Path']);

        foreach ($plugins as $plugin) {
            $table->addRow([
                $plugin['name'],
                $plugin['type'],
                $plugin['path'],
            ]);
        }

        $table->render();

        return Command::SUCCESS;
    }
}
