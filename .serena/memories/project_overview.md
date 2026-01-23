# Project Overview

## Purpose
CLI tool (`@ngxtm/skill-rule`) to sync coding rules across AI coding agents (Cursor, Claude Code, Copilot, OpenCode, Gemini).

## Tech Stack
- **Runtime**: Bun
- **Language**: TypeScript (ES modules)
- **Build**: Bun bundler
- **CLI Framework**: Commander.js
- **Parsing**: gray-matter (YAML frontmatter), yaml
- **Output**: picocolors

## Version
Current: 1.1.2

## Codebase Structure
```
src/
├── cli.ts              # Entry point
├── commands/           # CLI commands
├── core/
│   ├── agents.ts       # Agent definitions
│   ├── config.ts       # Config management
│   ├── parser.ts       # Rule parsing
│   ├── sync.ts         # Sync logic
│   └── types.ts        # TypeScript types
├── registry/
│   ├── adapter.ts      # Base adapter
│   ├── github-adapter.ts
│   ├── local-adapter.ts
│   └── index.ts
└── utils/
    ├── detect.ts       # Detection utilities
    └── fs.ts           # File system utilities
```

## Supported Agents
- Cursor (`.cursor/rules/`)
- Claude Code (`.claude/rules/`)
- GitHub Copilot (`.github/rules/`)
- OpenCode (`.opencode/rules/`)
- Gemini (`.gemini/rules/`)
