# @ngxtm/skill-rule

CLI to sync coding rules across AI coding agents (Cursor, Claude Code, Copilot, etc.).

## Install

```bash
npm install -g @ngxtm/skill-rule
# or
bun install -g @ngxtm/skill-rule
```

## Usage

```bash
# Initialize in your project
sr init

# Sync rules from registry
sr sync

# Sync from local directory
sr sync --local /path/to/rules

# List available categories
sr list

# Show supported agents
sr agents
```

## Config

`sr init` creates `.rules.json`:

```json
{
  "registry": {
    "type": "github",
    "url": "https://github.com/ngxtm/skill-rule",
    "branch": "main"
  },
  "agents": ["cursor", "claude"],
  "categories": {
    "react": { "enabled": true },
    "typescript": { "enabled": true }
  }
}
```

### Options

- `registry.type`: `github`, `local`, or `http`
- `agents`: Array of agent IDs
- `categories[id].enabled`: Enable/disable category
- `categories[id].exclude`: Skip specific rules
- `categories[id].include`: Only sync these rules
- `overrides`: Rules to skip (overridden locally)

## Rule Format

Rules are markdown files with YAML frontmatter:

```markdown
---
id: react-hooks
version: 1.0.0
triggers: [hooks, useEffect, useState]
---

# React Hooks

Content here...
```

## Supported Agents

| Agent | Rules Path |
|-------|------------|
| Cursor | `.cursor/rules/` |
| Claude Code | `.claude/rules/` |
| GitHub Copilot | `.github/rules/` |
| OpenCode | `.opencode/rules/` |
| Gemini | `.gemini/rules/` |

## License

MIT
