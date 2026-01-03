<?php

declare(strict_types=1);

namespace LeeOvery\ClaudeManager\Console;

use LeeOvery\ClaudeManager\PluginManager;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Process\Process;

use function getcwd;

#[AsCommand(
    name: 'mode',
    description: 'Get or set the plugin installation mode (symlink or copy)'
)]
class ModeCommand extends Command
{
    protected function configure(): void
    {
        $this
            ->addArgument('mode', InputArgument::OPTIONAL, 'The mode to set: "symlink" or "copy"')
            ->setHelp(<<<'HELP'
Get or set the plugin installation mode.

<info>Modes:</info>
  <comment>symlink</comment> - Creates symlinks to vendor packages (default)
           Assets are gitignored and require composer install to work

  <comment>copy</comment>    - Copies files from vendor packages
           Assets are committed to the repository and work immediately
           Recommended for Claude Code for Web

<info>Examples:</info>
  Show current mode:   <comment>claude-plugins mode</comment>
  Switch to copy mode: <comment>claude-plugins mode copy</comment>
  Switch to symlink:   <comment>claude-plugins mode symlink</comment>
HELP);
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $composerJsonPath = getcwd().'/composer.json';

        if (! file_exists($composerJsonPath)) {
            $output->writeln('<error>No composer.json found in current directory</error>');

            return Command::FAILURE;
        }

        $currentMode = PluginManager::readModeFromComposerJson($composerJsonPath) ?? PluginManager::MODE_SYMLINK;
        $newMode = $input->getArgument('mode');

        // If no mode argument, just show current mode
        if ($newMode === null) {
            $output->writeln(sprintf('Current mode: <info>%s</info>', $currentMode));
            $output->writeln('');
            $output->writeln('Use <comment>claude-plugins mode copy</comment> or <comment>claude-plugins mode symlink</comment> to change.');

            return Command::SUCCESS;
        }

        // Validate the mode
        if (! in_array($newMode, [PluginManager::MODE_SYMLINK, PluginManager::MODE_COPY], true)) {
            $output->writeln(sprintf('<error>Invalid mode "%s". Use "symlink" or "copy".</error>', $newMode));

            return Command::FAILURE;
        }

        // If already in this mode, nothing to do
        if ($newMode === $currentMode) {
            $output->writeln(sprintf('Already in <info>%s</info> mode.', $currentMode));

            return Command::SUCCESS;
        }

        // Update composer.json
        $output->writeln(sprintf('Switching from <comment>%s</comment> to <info>%s</info> mode...', $currentMode, $newMode));
        $output->writeln('');

        if (! PluginManager::writeModeToComposerJson($composerJsonPath, $newMode)) {
            $output->writeln('<error>Failed to update composer.json</error>');

            return Command::FAILURE;
        }

        $output->writeln('<info>Updated composer.json</info>');

        // Clean up existing assets
        $output->writeln('<info>Cleaning up existing assets...</info>');
        $claudeDir = getcwd().'/.claude';
        $vendorDir = getcwd().'/vendor';
        $manager = new PluginManager($claudeDir, $vendorDir, null, $newMode);

        $manager->cleanupAllAssets();

        // If switching to copy mode, remove all gitignore entries
        if ($newMode === PluginManager::MODE_COPY) {
            $output->writeln('<info>Removing gitignore entries...</info>');
            $manager->removeAllGitignoreEntries();
        }

        // Re-run composer install to trigger plugin reinstallation
        $output->writeln('');
        $output->writeln('<info>Re-installing plugins in new mode...</info>');
        $output->writeln('');

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
        $output->writeln(sprintf('<info>✓ Switched to %s mode!</info>', $newMode));

        if ($newMode === PluginManager::MODE_COPY) {
            $output->writeln('');
            $output->writeln('<comment>Note: Plugin assets are now copied to .claude/ and can be committed to git.</comment>');
            $output->writeln('<comment>Any changes you make will be overwritten on composer update.</comment>');
        }

        return Command::SUCCESS;
    }
}
