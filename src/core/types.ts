/**
 * Core types for skill-rule
 * Using discriminated unions and branded types for type safety
 */

// Branded types for type safety
export type RuleId = string & { readonly __brand: 'RuleId' };
export type CategoryId = string & { readonly __brand: 'CategoryId' };

// Rule metadata from frontmatter
export interface RuleMeta {
  id: RuleId;
  version: string;
  triggers: string[];
  extends?: RuleId;
  category: CategoryId;
}

// Parsed rule with content
export interface Rule {
  meta: RuleMeta;
  content: string;
  references: RuleReference[];
  sourcePath: string;
}

export interface RuleReference {
  path: string;
  content: string;
  loadMode: 'eager' | 'on-demand';
}

// Agent definitions
export type AgentId = 'cursor' | 'claude' | 'copilot' | 'antigravity' | 'opencode' | 'gemini';

export interface AgentConfig {
  id: AgentId;
  name: string;
  rulesPath: string;
  detectionFiles: string[];
}

// Registry types - Strategy Pattern
export type RegistryType = 'github' | 'local' | 'http';

export interface RegistryConfig {
  type: RegistryType;
  url: string;
  branch?: string;
  token?: string;
}

// Project config (.rules.json)
export interface ProjectConfig {
  registry: RegistryConfig;
  agents: AgentId[];
  categories: {
    [key: string]: CategoryConfig;
  };
  overrides?: string[];
}

export interface CategoryConfig {
  enabled: boolean;
  version?: string;
  exclude?: string[];
  include?: string[];
}

// Sync result
export interface SyncResult {
  success: boolean;
  synced: RuleSyncInfo[];
  skipped: RuleSyncInfo[];
  errors: SyncError[];
}

export interface RuleSyncInfo {
  ruleId: RuleId;
  category: CategoryId;
  agent: AgentId;
  path: string;
}

export interface SyncError {
  ruleId?: RuleId;
  message: string;
  cause?: Error;
}
