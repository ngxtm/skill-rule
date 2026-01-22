/**
 * Local Registry Adapter
 * Reads rules from local filesystem
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { exists } from '../utils/fs.ts';
import type { RegistryAdapter } from './adapter.ts';
import type { Rule, CategoryId } from '../core/types.ts';
import { ruleParser } from '../core/parser.ts';

export class LocalRegistryAdapter implements RegistryAdapter {
  constructor(private basePath: string) {}

  async fetchCategory(category: CategoryId): Promise<Rule[]> {
    const categoryPath = join(this.basePath, 'rules', category);

    if (!(await exists(categoryPath))) {
      return [];
    }

    const rules: Rule[] = [];
    await this.scanDir(categoryPath, category, rules);
    return rules;
  }

  // Recursively scan directory for rule files
  private async scanDir(dirPath: string, category: string, rules: Rule[]): Promise<void> {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await this.scanDir(fullPath, category, rules);
      } else if (entry.isFile() && (entry.name.endsWith('.rule.md') || entry.name === 'SKILL.md')) {
        const content = await readFile(fullPath, 'utf-8');
        const relativePath = fullPath.replace(this.basePath + '/', '').replace(this.basePath + '\\', '');
        const rule = ruleParser.parse(content, relativePath);
        rules.push(rule);
      }
    }
  }

  async fetchRule(path: string): Promise<Rule | null> {
    const fullPath = join(this.basePath, path);

    if (!(await exists(fullPath))) {
      return null;
    }

    const content = await readFile(fullPath, 'utf-8');
    return ruleParser.parse(content, path);
  }

  async listCategories(): Promise<CategoryId[]> {
    const rulesPath = join(this.basePath, 'rules');

    if (!(await exists(rulesPath))) {
      return [];
    }

    const entries = await readdir(rulesPath, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory())
      .map(e => e.name as CategoryId);
  }

  async isAvailable(): Promise<boolean> {
    return exists(join(this.basePath, 'rules'));
  }
}
