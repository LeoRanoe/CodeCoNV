/* eslint-disable @typescript-eslint/no-require-imports -- a --require preload has to be CommonJS */
/**
 * Loaded into the Next server with `node --require`. The Blob SDK reads private files from
 * https://<store>.private.blob.vercel-storage.com; here that host is rewritten to the fake store
 * on 127.0.0.1, so nothing leaves the machine. Only for the local test stack.
 */
const { Agent, setGlobalDispatcher } = require("undici");

const target = process.env.VERCEL_BLOB_API_URL;
if (!target || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(target)) {
  throw new Error("fake-blob preload: VERCEL_BLOB_API_URL must be a local address");
}

class FakeBlobAgent extends Agent {
  dispatch(options, handler) {
    const hostname = new URL(String(options.origin ?? "http://unknown")).hostname;
    if (hostname.endsWith(".blob.vercel-storage.com")) {
      return super.dispatch({ ...options, origin: target, path: `/__blob${options.path}` }, handler);
    }
    return super.dispatch(options, handler);
  }
}

setGlobalDispatcher(new FakeBlobAgent());
