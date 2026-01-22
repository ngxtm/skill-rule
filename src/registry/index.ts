/**
 * Registry Factory
 * Creates appropriate adapter based on config
 */

import type { RegistryAdapter, RegistryOptions } from './adapter.ts';
import { LocalRegistryAdapter } from './local-adapter.ts';
import { GitHubRegistryAdapter } from './github-adapter.ts';

export function createRegistry(options: RegistryOptions): RegistryAdapter {
  switch (options.type) {
    case 'local':
      return new LocalRegistryAdapter(options.url);

    case 'github':
      return new GitHubRegistryAdapter(options.url, options.branch, options.token);

    case 'http':
      throw new Error('HTTP registry not yet implemented');

    default:
      throw new Error(`Unknown registry type: ${options.type}`);
  }
}

export { type RegistryAdapter, type RegistryOptions } from './adapter.ts';
export { LocalRegistryAdapter } from './local-adapter.ts';
export { GitHubRegistryAdapter } from './github-adapter.ts';
