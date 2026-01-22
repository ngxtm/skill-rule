#!/usr/bin/env node
/**
 * skill-rule CLI
 * Manage and sync coding rules across AI agents
 */

import { Command } from 'commander';
import pc from 'picocolors';
import { ConfigManager } from './core/config.ts';
import { SyncEngine } from './core/sync.ts';
import { detectFrameworks, getFrameworkName, detectInPath, isValidCategory } from './utils/detect.ts';
import { getAllAgents, isValidAgent } from './core/agents.ts';
import { createRegistry } from './registry/index.ts';
import type { AgentId, CategoryConfig, CategoryId, RegistryConfig } from './core/types.ts';

const program = new Command();

program
  .name('skill-rule')
  .description('Sync coding rules to AI agents')
  .version('1.1.1');

// Init command
program
  .command('init')
  .description('Initialize rules config for this project')
  .option('-a, --agents <agents>', 'Comma-separated agent list', 'cursor,claude')
  .option('-r, --registry <url>', 'Registry URL')
  .option('-s, --scan <dirs>', 'Additional directories to scan (comma-separated)')
  .option('-y, --yes', 'Skip prompts, use defaults')
  .action(async (opts) => {
    const cwd = process.cwd();
    const config = new ConfigManager(cwd);

    if (await config.exists()) {
      console.log(pc.yellow('Config already exists: .rules.json'));
      return;
    }

    console.log(pc.cyan('Detecting frameworks...'));

    // Parse custom scan dirs from --scan flag
    const customScanDirs = opts.scan
      ? opts.scan.split(',').map((d: string) => d.trim())
      : undefined;

    // Detect frameworks with custom dirs
    const detected = await detectFrameworks(cwd, customScanDirs);

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

// Add command - add paths or categories post-init
program
  .command('add')
  .description('Add paths or categories to config')
  .argument('<items...>', 'Paths (./lib) or category names (react, nestjs)')
  .option('--no-sync', 'Skip auto-sync after adding')
  .action(async (items: string[], opts) => {
    const cwd = process.cwd();
    const configMgr = new ConfigManager(cwd);

    if (!(await configMgr.exists())) {
      console.log(pc.red('Config not found. Run "sr init" first.'));
      return;
    }

    const projectConfig = await configMgr.load();
    const addedCategories: CategoryId[] = [];
    const errors: string[] = [];

    for (const item of items) {
      // Check if item is a path (starts with ./ or /) or category name
      const isPath = item.startsWith('./') || item.startsWith('/') || item.startsWith('.\\');

      if (isPath) {
        // Detect frameworks in path
        const detected = await detectInPath(cwd, item);
        if (detected.length === 0) {
          errors.push(`No frameworks detected in: ${item}`);
        } else {
          for (const cat of detected) {
            if (!projectConfig.categories[cat]) {
              projectConfig.categories[cat] = { enabled: true };
              addedCategories.push(cat);
              console.log(pc.green(`  + ${getFrameworkName(cat)} (from ${item})`));
            }
          }
        }
      } else {
        // Validate category name
        if (isValidCategory(item)) {
          const catId = item as CategoryId;
          if (!projectConfig.categories[catId]) {
            projectConfig.categories[catId] = { enabled: true };
            addedCategories.push(catId);
            console.log(pc.green(`  + ${getFrameworkName(catId)}`));
          } else {
            console.log(pc.dim(`  = ${item} (already exists)`));
          }
        } else {
          errors.push(`Unknown category: ${item}`);
        }
      }
    }

    // Save updated config
    if (addedCategories.length > 0) {
      await configMgr.save(projectConfig);
      console.log(pc.green(`\nAdded ${addedCategories.length} category(s)`));
    }

    // Show errors
    for (const err of errors) {
      console.log(pc.yellow(`  ! ${err}`));
    }

    // Auto-sync unless --no-sync
    if (opts.sync && addedCategories.length > 0) {
      console.log(pc.cyan('\nSyncing rules...'));
      const engine = new SyncEngine(cwd);
      const result = await engine.sync(projectConfig);

      if (result.success) {
        console.log(pc.green(`Synced ${result.synced.length} rule(s)`));
      } else {
        console.log(pc.red('Sync failed'));
        for (const err of result.errors) {
          console.log(pc.red(`  ${err.message}`));
        }
      }
    } else if (!opts.sync) {
      console.log(pc.dim('\nRun "sr sync" to fetch rules.'));
    }
  });

program.parse();
