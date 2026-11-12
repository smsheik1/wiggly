import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";

function networkBlockedError(kind, target) {
  return new Error(
    `Offline test guard (--import tests/no-network.mjs): blocked unmocked ${kind} call to ${String(target || "unknown")}. Inject fetchFn or local stubs instead.`,
  );
}

// Block unstubbed global fetch() calls while allowing tests to explicitly stub globalThis.fetch if needed.
if (typeof globalThis.fetch === "function") {
  globalThis.fetch = async (input) => {
    const target = typeof input === "string" ? input : input?.url || String(input);
    throw networkBlockedError("fetch", target);
  };
}

http.request = function blockedHttpRequest(urlOrOpts) {
  const target = typeof urlOrOpts === "string" ? urlOrOpts : `${urlOrOpts?.hostname || urlOrOpts?.host || ""}:${urlOrOpts?.port || 80}`;
  throw networkBlockedError("http.request", target);
};
http.get = function blockedHttpGet(urlOrOpts) {
  return http.request(urlOrOpts);
};

https.request = function blockedHttpsRequest(urlOrOpts) {
  const target = typeof urlOrOpts === "string" ? urlOrOpts : `${urlOrOpts?.hostname || urlOrOpts?.host || ""}:${urlOrOpts?.port || 443}`;
  throw networkBlockedError("https.request", target);
};
https.get = function blockedHttpsGet(urlOrOpts) {
  return https.request(urlOrOpts);
};

const origSocketConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function guardedConnect(...args) {
  const first = args[0];
  const isUnixPipe =
    (typeof first === "string" && first.startsWith("/")) ||
    (first && typeof first === "object" && typeof first.path === "string");
  if (isUnixPipe) {
    return origSocketConnect.apply(this, args);
  }
  const target = typeof first === "object"
    ? `${first.host || first.hostname || "tcp"}:${first.port || ""}`
    : `${args[1] || "tcp"}:${first}`;
  throw networkBlockedError("net.Socket.connect", target);
};

tls.connect = function blockedTlsConnect(options) {
  const target = typeof options === "object" ? `${options.host || options.servername || "tls"}:${options.port || 443}` : String(options);
  throw networkBlockedError("tls.connect", target);
};
