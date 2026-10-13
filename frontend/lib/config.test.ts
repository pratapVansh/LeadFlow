import { afterEach, expect, test, vi } from "vitest";
import config from "../next.config";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { nextSettings } from "../scripts/next-local.mjs";

afterEach(() => vi.unstubAllEnvs());

test.each(["http://backend:8000", "http://localhost:8000"])("rewrites use configured API address %s", async (upstream) => {
  vi.stubEnv("API_INTERNAL_URL", upstream);
  expect(await config.rewrites!()).toEqual([{ source: "/api/:path*", destination: `${upstream}/api/:path*` }]);
});

test.each([undefined, ""])("missing or empty API address fails clearly", async (upstream) => {
  vi.stubEnv("API_INTERNAL_URL", upstream);
  await expect(config.rewrites!()).rejects.toThrow("API_INTERNAL_URL is required");
});

function withRoot(contents: string, check: (file: URL) => void) {
  const directory = mkdtempSync(join(tmpdir(), "leadflow-env-"));
  const file = join(directory, ".env");
  writeFileSync(file, contents);
  try { check(pathToFileURL(file)); } finally { rmSync(directory, { recursive: true }); }
}

test("local startup derives ports and exposes only the API address", () => {
  withRoot("POSTGRES_PASSWORD='never-forward-this'\nBACKEND_PORT=8300\nFRONTEND_PORT=3300", file => {
    expect(nextSettings({}, file)).toEqual({ env: { API_INTERNAL_URL: "http://localhost:8300" }, port: 3300 });
  });
});

test("process port settings override root settings and database variables are removed", () => {
  withRoot("BACKEND_PORT=8300\nFRONTEND_PORT=3300", file => {
    expect(nextSettings({ BACKEND_PORT: "8400", FRONTEND_PORT: "3400", POSTGRES_PASSWORD: "secret", DATABASE_URL: "secret", TEST_DATABASE_URL: "secret", PATH: "/bin" }, file))
      .toEqual({ env: { BACKEND_PORT: "8400", FRONTEND_PORT: "3400", PATH: "/bin", API_INTERNAL_URL: "http://localhost:8400" }, port: 3400 });
  });
});

test("Docker uses its explicit upstream without reading a root file or passing credentials", () => {
  expect(nextSettings({ API_INTERNAL_URL: "http://backend:8000", POSTGRES_USER: "secret", POSTGRES_PASSWORD: "secret" }, new URL("file:///missing/root/.env")))
    .toEqual({ env: { API_INTERNAL_URL: "http://backend:8000" }, port: undefined });
});

test("missing root file fails clearly for local startup", () => {
  expect(() => nextSettings({}, new URL("file:///missing/root/.env"))).toThrow("Create the root .env");
});

test("an explicitly empty upstream is rejected", () => {
  expect(() => nextSettings({ API_INTERNAL_URL: "" })).toThrow("API_INTERNAL_URL cannot be empty");
});

test.each(["", "invalid", "0", "65536"])("invalid local port %s is rejected", value => {
  withRoot(`BACKEND_PORT=${value}\nFRONTEND_PORT=3300`, file => {
    expect(() => nextSettings({}, file)).toThrow("BACKEND_PORT must be an integer between 1 and 65535");
  });
});
