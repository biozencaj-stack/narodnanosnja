import assert from "node:assert/strict";
import test from "node:test";
import type { ServerSessionResolution } from "../auth/server-session-contract";
import {
  WISHLIST_PRIVATE_HEADERS,
  WISHLIST_UNAVAILABLE_MESSAGE,
  createWishlistDeleteHandler,
  createWishlistGetHandler,
  createWishlistPostHandler,
  type WishlistFailure,
  type WishlistMethod,
} from "./wishlist-route";

function authenticated(userId = "user-1"): ServerSessionResolution {
  return Object.freeze({
    status: "authenticated" as const,
    principal: Object.freeze({
      id: userId,
      email: `${userId}@example.test`,
      firstName: "Session",
      lastName: "Profile",
      name: "Session Profile",
      role: "CUSTOMER" as const,
      requiresEmailVerification: false,
    }),
  });
}

function requestWithJson(
  method: "POST" | "DELETE",
  value: unknown,
): Request {
  return new Request("https://store.example.test/api/wishlist", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}

function malformedRequest(method: "POST" | "DELETE"): Request {
  return new Request("https://store.example.test/api/wishlist", {
    method,
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
}

async function json(response: Response): Promise<unknown> {
  return response.json();
}

function assertPrivate(response: Response): void {
  for (const [name, value] of Object.entries(WISHLIST_PRIVATE_HEADERS)) {
    assert.equal(response.headers.get(name), value);
  }
}

test("anonymous and unavailable stay distinct for every method before body or database work", async () => {
  for (const resolution of [
    Object.freeze({ status: "anonymous" as const }),
    Object.freeze({ status: "unavailable" as const }),
  ]) {
    for (const method of ["GET", "POST", "DELETE"] as const) {
      let operationCalls = 0;
      let bodyReads = 0;
      const reports: Readonly<WishlistFailure>[] = [];
      const resolveSession = async () => resolution;
      const reportFailure = (failure: Readonly<WishlistFailure>) => {
        reports.push(failure);
      };
      const request = {
        json: async () => {
          bodyReads += 1;
          throw new Error("must not parse");
        },
      } as unknown as Request;

      let response: Response;
      if (method === "GET") {
        response = await createWishlistGetHandler({
          resolveSession,
          findItemsByUserId: async () => {
            operationCalls += 1;
            return [];
          },
          reportFailure,
        })();
      } else if (method === "POST") {
        response = await createWishlistPostHandler({
          resolveSession,
          upsertItem: async () => {
            operationCalls += 1;
          },
          reportFailure,
        })(request);
      } else {
        response = await createWishlistDeleteHandler({
          resolveSession,
          deleteItems: async () => {
            operationCalls += 1;
          },
          reportFailure,
        })(request);
      }

      assert.equal(response.status, resolution.status === "anonymous" ? 401 : 503);
      assert.deepEqual(
        await json(response),
        resolution.status === "anonymous"
          ? { success: false, error: "Morate biti prijavljeni" }
          : { success: false, error: WISHLIST_UNAVAILABLE_MESSAGE },
      );
      assert.equal(operationCalls, 0);
      assert.equal(bodyReads, 0);
      assert.deepEqual(reports, []);
      assertPrivate(response);
    }
  }
});

test("resolver failures and malformed principals are coarse 503 for every method", async () => {
  const malformed = Object.freeze({
    status: "authenticated",
    principal: Object.freeze({ id: "" }),
  }) as unknown as ServerSessionResolution;

  for (const method of ["GET", "POST", "DELETE"] as const) {
    for (const resolveSession of [
      async (): Promise<ServerSessionResolution> => {
        throw new Error("private session failure");
      },
      async () => malformed,
    ]) {
      const reports: Readonly<WishlistFailure>[] = [];
      const reportFailure = (failure: Readonly<WishlistFailure>) => {
        assert.equal(Object.isFrozen(failure), true);
        reports.push(failure);
      };
      let response: Response;

      if (method === "GET") {
        response = await createWishlistGetHandler({
          resolveSession,
          findItemsByUserId: async () => {
            throw new Error("must not run");
          },
          reportFailure,
        })();
      } else if (method === "POST") {
        response = await createWishlistPostHandler({
          resolveSession,
          upsertItem: async () => {
            throw new Error("must not run");
          },
          reportFailure,
        })(malformedRequest("POST"));
      } else {
        response = await createWishlistDeleteHandler({
          resolveSession,
          deleteItems: async () => {
            throw new Error("must not run");
          },
          reportFailure,
        })(malformedRequest("DELETE"));
      }

      assert.equal(response.status, 503);
      assert.deepEqual(await json(response), {
        success: false,
        error: WISHLIST_UNAVAILABLE_MESSAGE,
      });
      assert.deepEqual(reports, [{ method, stage: "SESSION" }]);
      assertPrivate(response);
    }
  }
});

test("every factory resolves one fresh owner for repeated and parallel requests", async () => {
  for (const method of ["GET", "POST", "DELETE"] as const) {
    let sessionReads = 0;
    const operationOwners: string[] = [];
    const resolveSession = async () => {
      sessionReads += 1;
      return authenticated(`${method.toLowerCase()}-user-${sessionReads}`);
    };
    let invoke: (requestNumber: number) => Promise<Response>;

    if (method === "GET") {
      const handler = createWishlistGetHandler({
        resolveSession,
        findItemsByUserId: async (userId) => {
          operationOwners.push(userId);
          return [];
        },
        reportFailure: () => undefined,
      });
      invoke = () => handler();
    } else if (method === "POST") {
      const handler = createWishlistPostHandler({
        resolveSession,
        upsertItem: async (userId) => {
          operationOwners.push(userId);
        },
        reportFailure: () => undefined,
      });
      invoke = (requestNumber) =>
        handler(
          requestWithJson("POST", {
            productId: `product-${requestNumber}`,
          }),
        );
    } else {
      const handler = createWishlistDeleteHandler({
        resolveSession,
        deleteItems: async (userId) => {
          operationOwners.push(userId);
        },
        reportFailure: () => undefined,
      });
      invoke = (requestNumber) =>
        handler(
          requestWithJson("DELETE", {
            productId: `product-${requestNumber}`,
          }),
        );
    }

    const first = await invoke(1);
    const second = await invoke(2);
    const parallel = await Promise.all([invoke(3), invoke(4)]);

    assert.equal(sessionReads, 4);
    assert.deepEqual(operationOwners, [
      `${method.toLowerCase()}-user-1`,
      `${method.toLowerCase()}-user-2`,
      `${method.toLowerCase()}-user-3`,
      `${method.toLowerCase()}-user-4`,
    ]);
    for (const response of [first, second, ...parallel]) {
      assert.equal(response.status, 200);
      assertPrivate(response);
    }
  }
});

test("GET reads only the fresh principal owner and projects product ids without adapter drift", async () => {
  let sessionReads = 0;
  const lookupIds: string[] = [];
  const privateRow = Object.freeze({
    productId: "product-1",
    userId: "private-user-id",
    internalNote: "PII-LEAK",
    toJSON: () => ({ productId: "leaked-product", internalNote: "PII-LEAK" }),
  });
  const handler = createWishlistGetHandler({
    resolveSession: async () => {
      sessionReads += 1;
      return authenticated(`user-${sessionReads}`);
    },
    findItemsByUserId: async (userId) => {
      lookupIds.push(userId);
      return [privateRow, Object.freeze({ productId: null })];
    },
    reportFailure: () => undefined,
  });

  const [first, second] = await Promise.all([handler(), handler()]);

  assert.equal(sessionReads, 2);
  assert.deepEqual(lookupIds, ["user-1", "user-2"]);
  assert.deepEqual(await json(first), {
    success: true,
    data: ["product-1", null],
  });
  assert.deepEqual(await json(second), {
    success: true,
    data: ["product-1", null],
  });
  assertPrivate(first);
  assertPrivate(second);
});

test("GET never delegates collection projection or JSON serialization to an adapter", async () => {
  let adapterMapCalls = 0;
  const adapterRows = [
    Object.freeze({
      productId: "product-1",
      privateUserId: "victim",
      token: "secret",
    }),
  ];
  Object.defineProperty(adapterRows, "map", {
    value: () => {
      adapterMapCalls += 1;
      return {
        toJSON: () => ({
          privateUserId: "victim",
          token: "secret",
        }),
      };
    },
  });
  const handler = createWishlistGetHandler({
    resolveSession: async () => authenticated("owner-1"),
    findItemsByUserId: async () => adapterRows,
    reportFailure: () => undefined,
  });

  const response = await handler();

  assert.equal(response.status, 200);
  assert.equal(adapterMapCalls, 0);
  assert.deepEqual(await json(response), {
    success: true,
    data: ["product-1"],
  });
  assertPrivate(response);
});

test("POST ignores body ownership fields and resolves a fresh owner per request", async () => {
  let sessionReads = 0;
  const writes: Array<Readonly<{ userId: string; productId: unknown }>> = [];
  const handler = createWishlistPostHandler({
    resolveSession: async () => {
      sessionReads += 1;
      return authenticated(`user-${sessionReads}`);
    },
    upsertItem: async (userId, productId) => {
      writes.push(Object.freeze({ userId, productId }));
      return Object.freeze({ id: "wishlist-row" });
    },
    reportFailure: () => undefined,
  });

  const first = await handler(
    requestWithJson("POST", {
      productId: "product-1",
      userId: "attacker",
      internalNote: "ignored",
    }),
  );
  const second = await handler(
    requestWithJson("POST", {
      productId: "product-2",
      userId: "attacker",
    }),
  );

  assert.equal(sessionReads, 2);
  assert.deepEqual(writes, [
    { userId: "user-1", productId: "product-1" },
    { userId: "user-2", productId: "product-2" },
  ]);
  for (const response of [first, second]) {
    assert.equal(response.status, 200);
    assert.deepEqual(await json(response), {
      success: true,
      message: "Proizvod dodat u listu želja",
    });
    assertPrivate(response);
  }
});

test("DELETE remains owner-scoped, idempotent and successful for a zero-row result", async () => {
  const deletes: Array<Readonly<{ userId: string; productId: unknown }>> = [];
  const handler = createWishlistDeleteHandler({
    resolveSession: async () => authenticated("owner-1"),
    deleteItems: async (userId, productId) => {
      deletes.push(Object.freeze({ userId, productId }));
      return Object.freeze({ count: 0 });
    },
    reportFailure: () => undefined,
  });

  const response = await handler(
    requestWithJson("DELETE", {
      productId: "product-1",
      userId: "attacker",
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await json(response), {
    success: true,
    message: "Proizvod uklonjen iz liste želja",
  });
  assert.deepEqual(deletes, [
    { userId: "owner-1", productId: "product-1" },
  ]);
  assertPrivate(response);
});

test("POST and DELETE preserve the existing falsy product id validation", async () => {
  for (const method of ["POST", "DELETE"] as const) {
    for (const productId of [undefined, null, "", 0, false]) {
      let writes = 0;
      const request = requestWithJson(method, { productId });
      const response =
        method === "POST"
          ? await createWishlistPostHandler({
              resolveSession: async () => authenticated(),
              upsertItem: async () => {
                writes += 1;
              },
              reportFailure: () => undefined,
            })(request)
          : await createWishlistDeleteHandler({
              resolveSession: async () => authenticated(),
              deleteItems: async () => {
                writes += 1;
              },
              reportFailure: () => undefined,
            })(request);

      assert.equal(response.status, 400);
      assert.deepEqual(await json(response), {
        success: false,
        error: "Product ID je obavezan",
      });
      assert.equal(writes, 0);
      assertPrivate(response);
    }
  }
});

test("malformed JSON and a null root preserve method-specific coarse 500", async () => {
  for (const method of ["POST", "DELETE"] as const) {
    for (const request of [
      malformedRequest(method),
      requestWithJson(method, null),
    ]) {
      const reports: Readonly<WishlistFailure>[] = [];
      let writes = 0;
      const reportFailure = (failure: Readonly<WishlistFailure>) => {
        reports.push(failure);
      };
      const response =
        method === "POST"
          ? await createWishlistPostHandler({
              resolveSession: async () => authenticated(),
              upsertItem: async () => {
                writes += 1;
              },
              reportFailure,
            })(request)
          : await createWishlistDeleteHandler({
              resolveSession: async () => authenticated(),
              deleteItems: async () => {
                writes += 1;
              },
              reportFailure,
            })(request);

      assert.equal(response.status, 500);
      assert.deepEqual(await json(response), {
        success: false,
        error:
          method === "POST"
            ? "Greška pri dodavanju u listu želja"
            : "Greška pri uklanjanju iz liste želja",
      });
      assert.deepEqual(reports, [{ method, stage: "BODY" }]);
      assert.equal(writes, 0);
      assertPrivate(response);
    }
  }
});

test("truthy non-string product ids preserve the database-owned 500 boundary", async () => {
  for (const method of ["POST", "DELETE"] as const) {
    const reports: Readonly<WishlistFailure>[] = [];
    const reportFailure = (failure: Readonly<WishlistFailure>) => {
      reports.push(failure);
    };
    const rejectNonString = async (_userId: string, productId: unknown) => {
      assert.equal(productId, 42);
      throw new TypeError("Prisma rejects a non-string productId");
    };
    const response =
      method === "POST"
        ? await createWishlistPostHandler({
            resolveSession: async () => authenticated(),
            upsertItem: rejectNonString,
            reportFailure,
          })(requestWithJson("POST", { productId: 42 }))
        : await createWishlistDeleteHandler({
            resolveSession: async () => authenticated(),
            deleteItems: rejectNonString,
            reportFailure,
          })(requestWithJson("DELETE", { productId: 42 }));

    assert.equal(response.status, 500);
    assert.deepEqual(reports, [{ method, stage: "DATABASE" }]);
    assertPrivate(response);
  }
});

test("database failures keep every method coarse and stage-only", async () => {
  const expectedErrors: Record<WishlistMethod, string> = {
    GET: "Greška pri učitavanju liste želja",
    POST: "Greška pri dodavanju u listu želja",
    DELETE: "Greška pri uklanjanju iz liste želja",
  };

  for (const method of ["GET", "POST", "DELETE"] as const) {
    const reports: Readonly<WishlistFailure>[] = [];
    const reportFailure = (failure: Readonly<WishlistFailure>) => {
      reports.push(failure);
    };
    const fail = async () => {
      throw new Error("private database failure for user-1/product-1");
    };
    let response: Response;
    if (method === "GET") {
      response = await createWishlistGetHandler({
        resolveSession: async () => authenticated(),
        findItemsByUserId: fail,
        reportFailure,
      })();
    } else if (method === "POST") {
      response = await createWishlistPostHandler({
        resolveSession: async () => authenticated(),
        upsertItem: fail,
        reportFailure,
      })(requestWithJson("POST", { productId: "product-1" }));
    } else {
      response = await createWishlistDeleteHandler({
        resolveSession: async () => authenticated(),
        deleteItems: fail,
        reportFailure,
      })(requestWithJson("DELETE", { productId: "product-1" }));
    }

    assert.equal(response.status, 500);
    assert.deepEqual(await json(response), {
      success: false,
      error: expectedErrors[method],
    });
    assert.deepEqual(reports, [{ method, stage: "DATABASE" }]);
    assertPrivate(response);
  }
});

test("reporter failures cannot replace session or database failure responses", async () => {
  const sessionResponse = await createWishlistGetHandler({
    resolveSession: async () => {
      throw new Error("private session failure");
    },
    findItemsByUserId: async () => {
      throw new Error("must not run");
    },
    reportFailure: () => {
      throw new Error("sync reporter failure");
    },
  })();
  const databaseResponse = await createWishlistPostHandler({
    resolveSession: async () => authenticated(),
    upsertItem: async () => {
      throw new Error("private database failure");
    },
    reportFailure: async () => {
      throw new Error("async reporter failure");
    },
  })(requestWithJson("POST", { productId: "product-1" }));

  assert.equal(sessionResponse.status, 503);
  assert.deepEqual(await json(sessionResponse), {
    success: false,
    error: WISHLIST_UNAVAILABLE_MESSAGE,
  });
  assert.equal(databaseResponse.status, 500);
  assert.deepEqual(await json(databaseResponse), {
    success: false,
    error: "Greška pri dodavanju u listu želja",
  });
  assertPrivate(sessionResponse);
  assertPrivate(databaseResponse);
});
