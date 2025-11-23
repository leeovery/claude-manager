<?php

declare(strict_types=1);

namespace LeeOvery\ClaudeManager\Console;

use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Process\Process;

use function getcwd;

class InstallCommand extends Command
{
    protected static $defaultName = 'install';

    protected function configure(): void
    {
        $this
            ->setDescription('Install Claude Code plugins')
            ->setHelp('Manually trigger plugin installation (usually runs automatically via Composer hooks)');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $output->writeln('<info>Running composer install to trigger plugin installation...</info>');

        $process = new Process(['composer', 'install'], getcwd());
        $process->setTimeout(300);

        $process->run(function ($type, $buffer) use ($output) {
            $output->write($buffer);
        });

        if (! $process->isSuccessful()) {
            $output->writeln('<error>Failed to run composer install</error>');

            return Command::FAILURE;
        }

        $output->writeln('');
        $output->writeln('<info>✓ Installation complete!</info>');

        return Command::SUCCESS;
    }
}
