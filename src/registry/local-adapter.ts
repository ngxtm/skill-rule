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
    const files = await readdir(categoryPath, { withFileTypes: true });

    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.rule.md')) {
        const filePath = join(categoryPath, file.name);
        const content = await readFile(filePath, 'utf-8');
        const relativePath = `rules/${category}/${file.name}`;
        const rule = ruleParser.parse(content, relativePath);
        rules.push(rule);
      }
    }

    return rules;
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
