# Code Style & Conventions

## File Naming
- Use **kebab-case** for file names
- Descriptive names (e.g., `github-adapter.ts`, `local-adapter.ts`)

## TypeScript
- ES modules (`"type": "module"`)
- Use TypeScript strict mode
- Export types from `core/types.ts`

## Code Organization
- Keep files under 200 lines
- Separate concerns into modules
- Use composition over inheritance

## Naming Conventions
- **Functions**: camelCase
- **Classes**: PascalCase
- **Constants**: UPPER_SNAKE_CASE
- **Files**: kebab-case

## Import Style
- Use named imports
- Group imports: external → internal

## Comments
- Add comments for complex logic only
- Self-documenting code preferred

## Error Handling
- Use try-catch for async operations
- Provide meaningful error messages
