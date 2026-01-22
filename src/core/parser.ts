/**
 * Rule Parser
 * Parses .rule.md files with YAML frontmatter
 */

import matter from 'gray-matter';
import type { Rule, RuleMeta, RuleReference, RuleId, CategoryId } from './types.ts';

export class RuleParser {
  /**
   * Parse a rule file content
   */
  parse(content: string, sourcePath: string): Rule {
    const { data, content: body } = matter(content);

    const meta = this.parseMeta(data, sourcePath);
    const references = this.parseReferences(body);

    return {
      meta,
      content: body,
      references,
      sourcePath,
    };
  }

  private parseMeta(data: Record<string, unknown>, sourcePath: string): RuleMeta {
    // Extract category from path: rules/flutter/bloc.rule.md -> flutter
    const pathParts = sourcePath.split('/');
    const categoryIndex = pathParts.findIndex(p => p === 'rules') + 1;
    const category = pathParts[categoryIndex] ?? 'unknown';

    return {
      id: (data.id as string ?? this.inferIdFromPath(sourcePath)) as RuleId,
      version: data.version as string ?? '1.0.0',
      triggers: Array.isArray(data.triggers) ? data.triggers : [],
      extends: data.extends as RuleId | undefined,
      category: category as CategoryId,
    };
  }

  private inferIdFromPath(sourcePath: string): string {
    // rules/flutter/bloc.rule.md -> flutter-bloc
    const match = sourcePath.match(/rules\/([^/]+)\/([^/]+)\.rule\.md$/);
    if (match) {
      return `${match[1]}-${match[2]}`;
    }
    return sourcePath.replace(/\.rule\.md$/, '').replace(/\//g, '-');
  }

  private parseReferences(content: string): RuleReference[] {
    const references: RuleReference[] = [];

    // Parse markdown links with load mode comments
    // Format: [name](./path.md) <!-- load: on-demand -->
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)(?:\s*<!--\s*load:\s*(eager|on-demand)\s*-->)?/g;

    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      const path = match[2];
      if (path && (path.endsWith('.md') || path.endsWith('.dart') || path.endsWith('.ts'))) {
        references.push({
          path,
          content: '', // Will be loaded later
          loadMode: (match[3] as 'eager' | 'on-demand') ?? 'on-demand',
        });
      }
    }

    return references;
  }
}

// Singleton instance
export const ruleParser = new RuleParser();
