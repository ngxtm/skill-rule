/**
 * Agent configurations
 * Factory Pattern for creating agent-specific configs
 */

import type { AgentConfig, AgentId } from './types.ts';

const AGENT_CONFIGS: Record<AgentId, AgentConfig> = {
  cursor: {
    id: 'cursor',
    name: 'Cursor',
    rulesPath: '.cursor/rules',
    detectionFiles: ['.cursor', '.cursorrules'],
  },
  claude: {
    id: 'claude',
    name: 'Claude Code',
    rulesPath: '.claude/rules',
    detectionFiles: ['.claude', 'CLAUDE.md'],
  },
  copilot: {
    id: 'copilot',
    name: 'GitHub Copilot',
    rulesPath: '.github/rules',
    detectionFiles: ['.github'],
  },
  antigravity: {
    id: 'antigravity',
    name: 'Antigravity',
    rulesPath: '.agent/rules',
    detectionFiles: ['.agent'],
  },
  opencode: {
    id: 'opencode',
    name: 'OpenCode',
    rulesPath: '.opencode/rules',
    detectionFiles: ['.opencode'],
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    rulesPath: '.gemini/rules',
    detectionFiles: ['.gemini'],
  },
};

export function getAgentConfig(id: AgentId): AgentConfig {
  return AGENT_CONFIGS[id];
}

export function getAllAgents(): AgentConfig[] {
  return Object.values(AGENT_CONFIGS);
}

export function isValidAgent(id: string): id is AgentId {
  return id in AGENT_CONFIGS;
}
