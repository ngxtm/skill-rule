/**
 * Registry Adapter Interface
 * Strategy Pattern for different registry sources
 */

import type { Rule, CategoryId } from '../core/types.ts';

export interface RegistryAdapter {
  /**
   * Fetch all rules from a category
   */
  fetchCategory(category: CategoryId): Promise<Rule[]>;

  /**
   * Fetch a single rule by path
   */
  fetchRule(path: string): Promise<Rule | null>;

  /**
   * List all available categories
   */
  listCategories(): Promise<CategoryId[]>;

  /**
   * Check if registry is accessible
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Registry Adapter Factory
 */
export type RegistryType = 'github' | 'local' | 'http';

export interface RegistryOptions {
  type: RegistryType;
  url: string;
  branch?: string;
  token?: string;
}
