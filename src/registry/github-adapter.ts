/**
 * GitHub Registry Adapter
 * Fetches rules from GitHub repositories via API
 */

import type { RegistryAdapter } from './adapter.ts';
import type { Rule, CategoryId } from '../core/types.ts';
import { ruleParser } from '../core/parser.ts';

interface GitHubTreeItem {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
}

interface GitHubTreeResponse {
  tree: GitHubTreeItem[];
  truncated: boolean;
}

export class GitHubRegistryAdapter implements RegistryAdapter {
  private owner: string;
  private repo: string;
  private branch: string;
  private token?: string;

  constructor(url: string, branch = 'main', token?: string) {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) throw new Error(`Invalid GitHub URL: ${url}`);

    this.owner = match[1]!;
    this.repo = match[2]!.replace(/\.git$/, '');
    this.branch = branch;
    this.token = token;
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  }

  async fetchCategory(category: CategoryId): Promise<Rule[]> {
    const tree = await this.fetchTree();
    if (!tree) return [];

    const ruleFiles = tree.tree.filter(
      item => item.type === 'blob' &&
              item.path.startsWith(`rules/${category}/`) &&
              item.path.endsWith('.rule.md')
    );

    const rules: Rule[] = [];

    for (const file of ruleFiles) {
      const content = await this.fetchFile(file.path);
      if (content) {
        const rule = ruleParser.parse(content, file.path);
        rules.push(rule);
      }
    }

    return rules;
  }

  async fetchRule(path: string): Promise<Rule | null> {
    const content = await this.fetchFile(path);
    if (!content) return null;
    return ruleParser.parse(content, path);
  }

  async listCategories(): Promise<CategoryId[]> {
    const tree = await this.fetchTree();
    if (!tree) return [];

    const categories = new Set<string>();

    for (const item of tree.tree) {
      if (item.type === 'tree' && item.path.startsWith('rules/')) {
        const parts = item.path.split('/');
        if (parts.length === 2 && parts[1]) {
          categories.add(parts[1]);
        }
      }
    }

    return Array.from(categories) as CategoryId[];
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${this.owner}/${this.repo}`,
        { headers: this.headers }
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  private async fetchTree(): Promise<GitHubTreeResponse | null> {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${this.owner}/${this.repo}/git/trees/${this.branch}?recursive=1`,
        { headers: this.headers }
      );
      if (!res.ok) return null;
      return res.json() as Promise<GitHubTreeResponse>;
    } catch {
      return null;
    }
  }

  private async fetchFile(path: string): Promise<string | null> {
    try {
      const url = `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${this.branch}/${path}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return res.text();
    } catch {
      return null;
    }
  }
}
