#!/usr/bin/env node
/**
 * skill-rule CLI
 * Manage and sync coding rules across AI agents
 */

import { Command } from 'commander';
import pc from 'picocolors';
import { ConfigManager } from './core/config.ts';
import { SyncEngine } from './core/sync.ts';
import { detectFrameworks, getFrameworkName } from './utils/detect.ts';
import { getAllAgents, isValidAgent } from './core/agents.ts';
import { createRegistry } from './registry/index.ts';
import type { AgentId, CategoryConfig, CategoryId, RegistryConfig } from './core/types.ts';

const program = new Command();

program
  .name('skill-rule')
  .description('Sync coding rules to AI agents')
  .version('1.0.0');

// Init command
program
  .command('init')
  .description('Initialize rules config for this project')
  .option('-a, --agents <agents>', 'Comma-separated agent list', 'cursor,claude')
  .option('-r, --registry <url>', 'Registry URL')
  .option('-y, --yes', 'Skip prompts, use defaults')
  .action(async (opts) => {
    const cwd = process.cwd();
    const config = new ConfigManager(cwd);

    if (await config.exists()) {
      console.log(pc.yellow('Config already exists: .rules.json'));
      return;
    }

    console.log(pc.cyan('Detecting frameworks...'));

    // Detect frameworks
    const detected = await detectFrameworks(cwd);

    if (detected.size === 0) {
      console.log(pc.yellow('No frameworks detected.'));
      console.log('Add categories manually to .rules.json');
    } else {
      console.log(pc.green(`Found ${detected.size} framework(s):`));
      for (const [id, locations] of detected) {
        console.log(`  ${pc.bold(getFrameworkName(id))} at ${locations.join(', ')}`);
      }
    }

    // Parse agents
    const agents = opts.agents
      .split(',')
      .map((a: string) => a.trim())
      .filter(isValidAgent) as AgentId[];

    if (agents.length === 0) {
      console.log(pc.red('No valid agents specified.'));
      return;
    }

    // Build category config
    const categories: Record<string, CategoryConfig> = {};
    for (const [id] of detected) {
      categories[id] = { enabled: true };
    }

    // Create config
    await config.create({
      agents,
      categories,
      registryUrl: opts.registry,
    });

    console.log(pc.green('\nCreated .rules.json'));
    console.log(`Agents: ${agents.join(', ')}`);
    console.log(`Categories: ${Object.keys(categories).join(', ') || '(none)'}`);
    console.log(pc.dim('\nRun "sr sync" to fetch rules.'));
  });

// Sync command
program
  .command('sync')
  .description('Sync rules from registry to local agent directories')
  .option('--local <path>', 'Sync from local registry path')
  .option('--dry-run', 'Show what would be synced without writing')
  .action(async (opts) => {
    const cwd = process.cwd();
    const configMgr = new ConfigManager(cwd);

    if (!(await configMgr.exists())) {
      console.log(pc.red('Config not found. Run "sr init" first.'));
      return;
    }

    const projectConfig = await configMgr.load();

    // Override registry if local path specified
    if (opts.local) {
      projectConfig.registry = {
        type: 'local',
        url: opts.local,
      };
    }

    console.log(pc.cyan('Syncing rules...'));

    if (opts.dryRun) {
      console.log(pc.dim('(dry run - no files will be written)'));
    }

    const engine = new SyncEngine(cwd);
    const result = await engine.sync(projectConfig);

    if (result.success) {
      console.log(pc.green(`\nSynced ${result.synced.length} rule(s)`));

      if (result.synced.length > 0) {
        for (const info of result.synced) {
          console.log(pc.dim(`  ${info.ruleId} -> ${info.agent}`));
        }
      }

      if (result.skipped.length > 0) {
        console.log(pc.yellow(`Skipped ${result.skipped.length} rule(s)`));
      }
    } else {
      console.log(pc.red('\nSync failed:'));
      for (const err of result.errors) {
        console.log(pc.red(`  ${err.message}`));
      }
    }
  });

// List command
program
  .command('list')
  .description('List available categories from registry')
  .option('--local <path>', 'Use local registry')
  .action(async (opts) => {
    const cwd = process.cwd();
    const configMgr = new ConfigManager(cwd);

    let registryConfig: RegistryConfig = {
      type: 'github',
      url: 'https://github.com/ngxtm/skill-rule',
      branch: 'main',
    };

    // Try to load from project config
    if (await configMgr.exists()) {
      const config = await configMgr.load();
      registryConfig = config.registry;
    }

    // Override if local specified
    if (opts.local) {
      registryConfig = { type: 'local', url: opts.local };
    }

    const registry = createRegistry(registryConfig);

    if (!(await registry.isAvailable())) {
      console.log(pc.red(`Registry not available: ${registryConfig.url}`));
      return;
    }

    console.log(pc.cyan('Available categories:\n'));

    const categories = await registry.listCategories();

    if (categories.length === 0) {
      console.log(pc.dim('  No categories found'));
    } else {
      for (const cat of categories) {
        const rules = await registry.fetchCategory(cat as CategoryId);
        console.log(`  ${pc.bold(cat)} (${rules.length} rules)`);
      }
    }
  });

// Agents command
program
  .command('agents')
  .description('List supported AI agents')
  .action(() => {
    console.log(pc.cyan('Supported agents:\n'));

    for (const agent of getAllAgents()) {
      console.log(`  ${pc.bold(agent.id.padEnd(12))} ${agent.name}`);
      console.log(pc.dim(`    Rules: ${agent.rulesPath}`));
    }
  });

program.parse();
