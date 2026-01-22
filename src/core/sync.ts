/**
 * Sync Engine
 * Handles syncing rules from registry to local agent directories
 */

import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { exists } from '../utils/fs.ts';
import type { Rule, ProjectConfig, SyncResult, RuleSyncInfo, SyncError, AgentId, CategoryId } from '../core/types.ts';
import { getAgentConfig } from '../core/agents.ts';
import { createRegistry } from '../registry/index.ts';

export class SyncEngine {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  async sync(config: ProjectConfig): Promise<SyncResult> {
    const synced: RuleSyncInfo[] = [];
    const skipped: RuleSyncInfo[] = [];
    const errors: SyncError[] = [];

    const registry = createRegistry(config.registry);

    // Check registry availability
    if (!(await registry.isAvailable())) {
      return {
        success: false,
        synced: [],
        skipped: [],
        errors: [{ message: `Registry not available: ${config.registry.url}` }],
      };
    }

    // Get enabled categories
    const enabledCategories = Object.entries(config.categories)
      .filter(([, cfg]) => cfg.enabled)
      .map(([id]) => id as CategoryId);

    // Fetch and sync rules for each category
    for (const category of enabledCategories) {
      const categoryConfig = config.categories[category];
      if (!categoryConfig) continue;

      try {
        const rules = await registry.fetchCategory(category);

        for (const rule of rules) {
          // Check include/exclude filters
          const ruleBaseName = rule.meta.id.split('-').pop() ?? rule.meta.id;

          if (categoryConfig.include && !categoryConfig.include.includes(ruleBaseName)) {
            continue;
          }

          if (categoryConfig.exclude?.includes(ruleBaseName)) {
            skipped.push({
              ruleId: rule.meta.id,
              category,
              agent: 'cursor' as AgentId, // Placeholder
              path: rule.sourcePath,
            });
            continue;
          }

          // Check overrides
          if (config.overrides?.includes(rule.meta.id)) {
            skipped.push({
              ruleId: rule.meta.id,
              category,
              agent: 'cursor' as AgentId,
              path: rule.sourcePath,
            });
            continue;
          }

          // Sync to each agent
          for (const agentId of config.agents) {
            try {
              await this.writeRuleToAgent(rule, agentId);
              synced.push({
                ruleId: rule.meta.id,
                category,
                agent: agentId,
                path: rule.sourcePath,
              });
            } catch (err) {
              errors.push({
                ruleId: rule.meta.id,
                message: `Failed to write to ${agentId}`,
                cause: err instanceof Error ? err : undefined,
              });
            }
          }
        }
      } catch (err) {
        errors.push({
          message: `Failed to fetch category ${category}`,
          cause: err instanceof Error ? err : undefined,
        });
      }
    }

    return {
      success: errors.length === 0,
      synced,
      skipped,
      errors,
    };
  }

  private async writeRuleToAgent(rule: Rule, agentId: AgentId): Promise<void> {
    const agent = getAgentConfig(agentId);
    const ruleFileName = rule.meta.id.split('-').slice(1).join('-') + '.rule.md';
    const targetPath = join(
      this.cwd,
      agent.rulesPath,
      rule.meta.category,
      ruleFileName
    );

    // Ensure directory exists
    await mkdir(dirname(targetPath), { recursive: true });

    // Write rule content with frontmatter
    const content = this.serializeRule(rule);
    await writeFile(targetPath, content, 'utf-8');
  }

  private serializeRule(rule: Rule): string {
    const frontmatter = [
      '---',
      `id: ${rule.meta.id}`,
      `version: ${rule.meta.version}`,
      `triggers: [${rule.meta.triggers.join(', ')}]`,
    ];

    if (rule.meta.extends) {
      frontmatter.push(`extends: ${rule.meta.extends}`);
    }

    frontmatter.push('---', '');

    return frontmatter.join('\n') + rule.content;
  }
}

export const syncEngine = new SyncEngine();
