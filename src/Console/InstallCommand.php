<?php

declare(strict_types=1);

namespace LeeOvery\ClaudeManager\Console;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Process\Process;

use function getcwd;

#[AsCommand(
    name: 'install',
    description: 'Install Claude Code plugins'
)]
class InstallCommand extends Command
{
    protected function configure(): void
    {
        $this->setHelp('Manually trigger plugin installation (usually runs automatically via Composer hooks)');
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
