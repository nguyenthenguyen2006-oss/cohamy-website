/* eslint-disable @typescript-eslint/no-require-imports */
const Module = require("node:module");
const { AsyncLocalStorage } = require("node:async_hooks");

globalThis.AsyncLocalStorage ??= AsyncLocalStorage;

const originalLoad = Module._load;

Module._load = function loadWithServerOnlyTestShim(
  request,
  parent,
  isMain,
) {
  if (request === "server-only") {
    return {};
  }

  return originalLoad.call(this, request, parent, isMain);
};
