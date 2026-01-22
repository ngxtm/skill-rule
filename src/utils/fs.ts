/**
 * File system utilities
 * Cross-platform helpers compatible with both Node.js and Bun
 */

import { access } from 'fs/promises';

/**
 * Check if a path exists
 * Node.js doesn't export `exists` from fs/promises, so we use access()
 */
export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
