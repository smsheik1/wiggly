import assert from "node:assert/strict";
import { test } from "node:test";
import { invokeConvex } from "../features/mcp/convex-ledger";

test("a Convex call keeps the client as this", async () => {
  const client = {
    marker: "bound",
    query(this: { marker: string }) {
      assert.equal(this.marker, "bound");
      return Promise.resolve("ok");
    },
    mutation(this: { marker: string }) {
      assert.equal(this.marker, "bound");
      return Promise.resolve("ok");
    },
  };
  assert.equal(await invokeConvex(client, "query", {}, {}), "ok");
  assert.equal(await invokeConvex(client, "mutation", {}, {}), "ok");
});
