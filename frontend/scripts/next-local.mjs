import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

/** @param {Record<string, string | undefined>} environment */
export function nextSettings(environment = process.env, rootFile = new URL("../../.env", import.meta.url)) {
  const env = { ...environment };
  for (const key of Object.keys(env)) {
    if (key.startsWith("POSTGRES_") || key === "DATABASE_URL" || key === "TEST_DATABASE_URL") delete env[key];
  }
  if (environment.API_INTERNAL_URL !== undefined) {
    if (!environment.API_INTERNAL_URL) throw new Error("API_INTERNAL_URL cannot be empty.");
    return { env, port: undefined };
  }
  let settings;
  try {
    settings = parseEnv(readFileSync(rootFile, "utf8"));
  } catch {
    throw new Error("Create the root .env from .env.example before running Next.js locally.");
  }
  function port(name) {
    const value = environment[name] ?? settings[name];
    if (!/^\d+$/.test(value ?? "") || Number(value) < 1 || Number(value) > 65535) {
      throw new Error(`${name} must be an integer between 1 and 65535 in the root .env or process environment.`);
    }
    return Number(value);
  }
  env.API_INTERNAL_URL = `http://localhost:${port("BACKEND_PORT")}`;
  return { env, port: port("FRONTEND_PORT") };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  if (!["dev", "build", "start"].includes(command)) throw new Error("Expected dev, build, or start.");
  const settings = nextSettings();
  const args = [createRequire(import.meta.url).resolve("next/dist/bin/next"), command];
  if (command !== "build") {
    args.push("--hostname", settings.port === undefined ? "0.0.0.0" : "127.0.0.1");
    if (settings.port !== undefined) args.push("--port", String(settings.port));
  }
  const child = spawn(process.execPath, [...args, ...process.argv.slice(3)], { env: settings.env, stdio: "inherit" });
  child.on("error", error => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 1; });
}
