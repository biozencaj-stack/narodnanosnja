export type SearchIndexingEnvironment = Readonly<
  Record<string, string | undefined>
>;

/**
 * Search indexing stays fail-closed until a reviewed production environment
 * explicitly enables it. Values other than the exact string "true" keep the
 * storefront out of search results.
 */
export function isSearchIndexingEnabled(
  environment: SearchIndexingEnvironment = process.env,
): boolean {
  return environment.SEARCH_INDEXING_ENABLED === "true";
}
