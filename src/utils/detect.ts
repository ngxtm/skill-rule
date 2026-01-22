/**
 * Framework detection
 * Detects frameworks from project files with monorepo support
 */

import { readFile, readdir } from 'fs/promises';
import { join, resolve } from 'path';
import { exists } from './fs.ts';
import type { CategoryId } from '../core/types.ts';

// Simple YAML parser for workspace configs (no external deps)
function parseYamlPackages(content: string): string[] {
  const packages: string[] = [];
  const lines = content.split('\n');
  let inPackages = false;

  for (const line of lines) {
    if (line.match(/^packages:\s*$/)) {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      if (line.match(/^\s+-\s+/)) {
        const pkg = line.replace(/^\s+-\s+['"]?/, '').replace(/['"]?\s*$/, '');
        packages.push(pkg);
      } else if (!line.match(/^\s/) && line.trim()) {
        break; // End of packages section
      }
    }
  }
  return packages;
}

// Resolve glob patterns like "packages/*" to actual directories
async function resolveGlobPatterns(cwd: string, patterns: string[]): Promise<string[]> {
  const dirs: string[] = [];

  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      // Handle simple glob: "packages/*" or "apps/*"
      const basePath = pattern.replace(/\/?\*.*$/, '');
      const fullBase = join(cwd, basePath);

      if (await exists(fullBase)) {
        try {
          const entries = await readdir(fullBase, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
              dirs.push(join(basePath, entry.name));
            }
          }
        } catch {
          // Ignore permission errors
        }
      }
    } else {
      // Direct path
      if (await exists(join(cwd, pattern))) {
        dirs.push(pattern);
      }
    }
  }

  return dirs;
}

// Get scan directories from workspace config files
async function getScanDirsFromWorkspace(cwd: string): Promise<string[]> {
  const patterns: string[] = [];

  // 1. pnpm-workspace.yaml
  const pnpmPath = join(cwd, 'pnpm-workspace.yaml');
  if (await exists(pnpmPath)) {
    try {
      const content = await readFile(pnpmPath, 'utf-8');
      patterns.push(...parseYamlPackages(content));
    } catch {
      // Ignore parse errors
    }
  }

  // 2. package.json workspaces (npm/yarn/turborepo)
  const pkgPath = join(cwd, 'package.json');
  if (await exists(pkgPath)) {
    try {
      const content = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);
      if (pkg.workspaces) {
        const workspaces = Array.isArray(pkg.workspaces)
          ? pkg.workspaces
          : pkg.workspaces.packages || [];
        patterns.push(...workspaces);
      }
    } catch {
      // Ignore parse errors
    }
  }

  // 3. lerna.json
  const lernaPath = join(cwd, 'lerna.json');
  if (await exists(lernaPath)) {
    try {
      const content = await readFile(lernaPath, 'utf-8');
      const lerna = JSON.parse(content);
      if (lerna.packages) {
        patterns.push(...lerna.packages);
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Resolve glob patterns to actual directories
  return resolveGlobPatterns(cwd, [...new Set(patterns)]);
}

interface FrameworkDef {
  id: CategoryId;
  name: string;
  detectionFiles: string[];
  detectionDeps: string[];
}

const FRAMEWORKS: FrameworkDef[] = [
  {
    id: 'flutter' as CategoryId,
    name: 'Flutter',
    detectionFiles: ['pubspec.yaml'],
    detectionDeps: ['flutter'],
  },
  {
    id: 'react' as CategoryId,
    name: 'React',
    detectionFiles: [],
    detectionDeps: ['react', 'react-dom'],
  },
  {
    id: 'nextjs' as CategoryId,
    name: 'Next.js',
    detectionFiles: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
    detectionDeps: ['next'],
  },
  {
    id: 'nestjs' as CategoryId,
    name: 'NestJS',
    detectionFiles: [],
    detectionDeps: ['@nestjs/core'],
  },
  {
    id: 'rust' as CategoryId,
    name: 'Rust',
    detectionFiles: ['Cargo.toml'],
    detectionDeps: [],
  },
  {
    id: 'golang' as CategoryId,
    name: 'Go',
    detectionFiles: ['go.mod'],
    detectionDeps: [],
  },
  {
    id: 'typescript' as CategoryId,
    name: 'TypeScript',
    detectionFiles: ['tsconfig.json'],
    detectionDeps: ['typescript'],
  },
];

export async function detectFrameworks(
  cwd: string,
  customScanDirs?: string[]
): Promise<Map<CategoryId, string[]>> {
  const detected = new Map<CategoryId, string[]>();

  // Get scan dirs: custom + workspace + defaults
  const defaultDirs = ['apps', 'packages', 'src-tauri'];
  const workspaceDirs = await getScanDirsFromWorkspace(cwd);

  const allDirs = new Set<string>(['.']);

  // Add workspace dirs first (higher priority)
  for (const dir of workspaceDirs) {
    allDirs.add(dir);
  }

  // Add custom dirs from --scan flag
  if (customScanDirs) {
    for (const dir of customScanDirs) {
      allDirs.add(dir);
    }
  }

  // Add defaults only if no workspace config found
  if (workspaceDirs.length === 0) {
    for (const dir of defaultDirs) {
      allDirs.add(dir);
    }
  }

  for (const dir of allDirs) {
    const fullPath = join(cwd, dir);
    if (!(await exists(fullPath))) continue;

    if (dir === '.') {
      await detectInDir(fullPath, '.', detected);
    } else {
      // For workspace dirs, scan directly (they are already resolved)
      if (workspaceDirs.includes(dir) || customScanDirs?.includes(dir)) {
        await detectInDir(fullPath, dir, detected);
      } else {
        // For default dirs, scan subdirectories
        try {
          const entries = await readdir(fullPath, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              await detectInDir(join(fullPath, entry.name), `${dir}/${entry.name}`, detected);
            }
          }
        } catch {
          // Ignore permission errors
        }
      }
    }
  }

  return detected;
}

async function detectInDir(
  dirPath: string,
  location: string,
  results: Map<CategoryId, string[]>
): Promise<void> {
  const deps = await getDepsFromPackageJson(dirPath);

  for (const fw of FRAMEWORKS) {
    let found = false;

    // Check detection files
    for (const file of fw.detectionFiles) {
      if (await exists(join(dirPath, file))) {
        found = true;
        break;
      }
    }

    // Check deps
    if (!found && fw.detectionDeps.length > 0) {
      found = fw.detectionDeps.some(dep => deps.has(dep));
    }

    if (found) {
      const locations = results.get(fw.id) ?? [];
      if (!locations.includes(location)) {
        locations.push(location);
      }
      results.set(fw.id, locations);
    }
  }
}

async function getDepsFromPackageJson(dir: string): Promise<Set<string>> {
  const pkgPath = join(dir, 'package.json');
  const deps = new Set<string>();

  if (await exists(pkgPath)) {
    try {
      const content = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);
      const allDeps = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
      };
      for (const key of Object.keys(allDeps)) {
        deps.add(key);
      }
    } catch {
      // Ignore parse errors
    }
  }

  return deps;
}

export function getFrameworkName(id: CategoryId): string {
  return FRAMEWORKS.find(f => f.id === id)?.name ?? id;
}

// Export for sr add command - detect frameworks in a single directory
export async function detectInPath(
  cwd: string,
  targetPath: string
): Promise<CategoryId[]> {
  const detected = new Map<CategoryId, string[]>();
  const fullPath = join(cwd, targetPath);

  if (!(await exists(fullPath))) {
    return [];
  }

  await detectInDir(fullPath, targetPath, detected);
  return Array.from(detected.keys());
}

// Export for validation - check if category exists
export function isValidCategory(id: string): boolean {
  return FRAMEWORKS.some(f => f.id === id);
}

// Get all valid category IDs
export function getAllCategories(): CategoryId[] {
  return FRAMEWORKS.map(f => f.id);
}
