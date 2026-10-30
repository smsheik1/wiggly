/**
 * Safely imports an external module at runtime from a file URL or specifier
 * without Webpack / Next.js bundler intercepting it and throwing
 * "Cannot find module as expression is too dynamic".
 *
 * Using `new Function` hides the `import()` expression from Webpack's AST parser,
 * deferring module resolution to Node's native ESM loader at runtime.
 */
export const runtimeImport = new Function(
  "specifier",
  "return import(specifier)"
) as <T = any>(specifier: string) => Promise<T>;
