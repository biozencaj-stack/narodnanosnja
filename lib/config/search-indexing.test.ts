import assert from "node:assert/strict";
import test from "node:test";
import { isSearchIndexingEnabled } from "./search-indexing";

test("search indexing is disabled unless explicitly enabled", () => {
  assert.equal(isSearchIndexingEnabled({}), false);
  assert.equal(
    isSearchIndexingEnabled({ SEARCH_INDEXING_ENABLED: "false" }),
    false,
  );
  assert.equal(
    isSearchIndexingEnabled({ SEARCH_INDEXING_ENABLED: "TRUE" }),
    false,
  );
  assert.equal(
    isSearchIndexingEnabled({ SEARCH_INDEXING_ENABLED: " true" }),
    false,
  );
  assert.equal(
    isSearchIndexingEnabled({ SEARCH_INDEXING_ENABLED: "true" }),
    true,
  );
});
