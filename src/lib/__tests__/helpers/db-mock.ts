/**
 * makeDbMock — Drizzle ORM-compatible chainable mock for Vitest route tests.
 *
 * Drizzle queries use a builder pattern:
 *   db.select({}).from(table).where(cond).orderBy(col).limit(10).offset(0)
 *
 * Each method in the chain returns a new "builder" object. When you `await`
 * the final builder, it resolves to data.  This mock makes EVERY method in
 * the chain return a Proxy that is BOTH chainable and thenable, so it works
 * regardless of which method in the chain is the last one you call before
 * `await`.
 *
 * Results are consumed in ORDER — the first `await` gets results[0], the
 * second gets results[1], etc.  Set up your results array to match the order
 * queries appear in the route handler source, including queries inside
 * Promise.all([...]).
 *
 * Usage:
 *
 *   const db = makeDbMock([
 *     [{ total: 3 }],                          // first await → count query
 *     [{ id: 'p1', name: 'Ravi' }],            // second await → list query
 *   ]);
 *   vi.mocked(getDb).mockReturnValue(db as never);
 */

/**
 * Pass as the second argument when calling non-parameterized route handlers
 * in tests.  The type matches what Next.js expects; the runtime value is safe
 * because withRoute uses `context?.params ?? {}` internally.
 *
 * Usage:
 *   const res = await GET(req, NO_PARAMS);
 *   const res = await POST(req, NO_PARAMS);
 */
export const NO_PARAMS = { params: Promise.resolve({} as Record<string, string>) };

export function makeDbMock(results: unknown[] = []) {
  let callIndex = 0;

  const chainHandler: ProxyHandler<object> = {
    get(_, prop: string | symbol) {
      // Make the proxy thenable — called implicitly by `await`
      if (prop === "then") {
        const value = results[callIndex++] ?? [];
        return (
          resolve: (v: unknown) => void,
          reject?: (e: unknown) => void
        ) => Promise.resolve(value).then(resolve, reject);
      }
      // Skip symbols other than `then` to avoid breaking Proxy
      if (typeof prop === "symbol") return undefined;
      // `.catch` and `.finally` not needed — we resolve, never reject
      if (prop === "catch" || prop === "finally") return undefined;
      // Every other method call (from, where, limit, offset, values, set …)
      // returns a new Proxy on the same handler, keeping the chain going.
      return (..._: unknown[]) => new Proxy({} as object, chainHandler);
    },
  };

  const makeChain = () => new Proxy({} as object, chainHandler);

  return {
    select:  (..._: unknown[]) => makeChain(),
    insert:  (..._: unknown[]) => makeChain(),
    update:  (..._: unknown[]) => makeChain(),
    delete:  (..._: unknown[]) => makeChain(),
    /** D1 batch — used by runCascade(); always resolves with [] in tests */
    batch:   (..._: unknown[]) => Promise.resolve([]),
  };
}
