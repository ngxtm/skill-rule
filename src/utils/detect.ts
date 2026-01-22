/**
 * Framework detection
 * Detects frameworks from project files
 */

import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { exists } from './fs.ts';
import type { CategoryId } from '../core/types.ts';

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

export async function detectFrameworks(cwd: string): Promise<Map<CategoryId, string[]>> {
  const detected = new Map<CategoryId, string[]>();

  // Scan root and common subdirs
  const scanDirs = ['.', 'apps', 'packages', 'src-tauri'];

  for (const dir of scanDirs) {
    const fullPath = join(cwd, dir);
    if (!(await exists(fullPath))) continue;

    if (dir === '.') {
      await detectInDir(fullPath, '.', detected);
    } else {
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
