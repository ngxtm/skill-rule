/**
 * Config manager
 * Handles .rules.json project config
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { exists } from '../utils/fs.ts';
import type { ProjectConfig, AgentId, CategoryConfig } from '../core/types.ts';

const CONFIG_FILE = '.rules.json';

const DEFAULT_CONFIG: ProjectConfig = {
  registry: {
    type: 'github',
    url: 'https://github.com/ngxtm/skill-rule',
    branch: 'main',
  },
  agents: ['cursor', 'claude', 'copilot'],
  categories: {},
};

export class ConfigManager {
  private configPath: string;

  constructor(cwd: string = process.cwd()) {
    this.configPath = join(cwd, CONFIG_FILE);
  }

  async exists(): Promise<boolean> {
    return exists(this.configPath);
  }

  async load(): Promise<ProjectConfig> {
    if (!(await this.exists())) {
      throw new Error(`Config not found: ${CONFIG_FILE}. Run 'sr init' first.`);
    }

    const content = await readFile(this.configPath, 'utf-8');
    return JSON.parse(content) as ProjectConfig;
  }

  async save(config: ProjectConfig): Promise<void> {
    const content = JSON.stringify(config, null, 2);
    await writeFile(this.configPath, content, 'utf-8');
  }

  async create(options: {
    agents: AgentId[];
    categories: Record<string, CategoryConfig>;
    registryUrl?: string;
  }): Promise<ProjectConfig> {
    const config: ProjectConfig = {
      ...DEFAULT_CONFIG,
      agents: options.agents,
      categories: options.categories,
    };

    if (options.registryUrl) {
      config.registry.url = options.registryUrl;
    }

    await this.save(config);
    return config;
  }

  getConfigPath(): string {
    return this.configPath;
  }
}

export const configManager = new ConfigManager();
