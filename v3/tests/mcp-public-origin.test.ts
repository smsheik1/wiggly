import assert from "node:assert/strict";
import { test } from "node:test";
import { publicOrigin } from "../features/mcp/public-origin";

test("upload and checkout stay on the public host when the proxy request is localhost", () => {
  const previousApp = process.env.APP_URL;
  const previousBase = process.env.V3_PUBLIC_BASE_URL;
  delete process.env.APP_URL;
  delete process.env.V3_PUBLIC_BASE_URL;
  assert.equal(publicOrigin(), "https://wiggly.agentenamel.com");
  process.env.APP_URL = "https://localhost:3020";
  assert.equal(publicOrigin(), "https://wiggly.agentenamel.com");
  process.env.APP_URL = "https://wiggly.agentenamel.com/";
  assert.equal(publicOrigin(), "https://wiggly.agentenamel.com");
  if (previousApp === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = previousApp;
  if (previousBase === undefined) delete process.env.V3_PUBLIC_BASE_URL;
  else process.env.V3_PUBLIC_BASE_URL = previousBase;
});
