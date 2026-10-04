// Run after building: node scripts/smoke-container.mjs khanara:cost-optimized
// Creates only isolated local resources and removes them even after a failure.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";

const require = createRequire(
  new URL("../client/package.json", import.meta.url),
);
const {
  HubConnectionBuilder,
  HttpTransportType,
  LogLevel,
} = require("@microsoft/signalr");
const image = process.argv[2] ?? "khanara:cost-optimized";
const suffix = randomUUID().slice(0, 8);
const network = `khanara-smoke-${suffix}`;
const db = `${network}-db`;
const app = `${network}-app`;
const createdContainers = [];
let createdNetwork = false;
let hub;

function docker(...args) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    timeout: 30000,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `docker ${args[0]} failed: ${result.error?.message ?? result.stderr}`,
    );
  }
  return (
    args[0] === "logs" ? result.stdout + result.stderr : result.stdout
  ).trim();
}

async function waitFor(check, description, container) {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    if (
      container &&
      docker("inspect", "--format", "{{.State.Running}}", container) !== "true"
    ) {
      throw new Error(`${description}: container exited before becoming ready`);
    }
    try {
      if (await check()) return;
    } catch {
      /* startup is still in progress */
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

try {
  docker("network", "create", network);
  createdNetwork = true;
  docker(
    "run",
    "-d",
    "--name",
    db,
    "--network",
    network,
    "-e",
    "POSTGRES_PASSWORD=local-smoke-password",
    "-e",
    "POSTGRES_DB=khanara",
    "postgres:17",
  );
  createdContainers.push(db);
  await waitFor(
    () =>
      docker("exec", db, "pg_isready", "-U", "postgres").includes(
        "accepting connections",
      ),
    "PostgreSQL",
  );
  const config = {
    ASPNETCORE_ENVIRONMENT: "Production",
    ASPNETCORE_FORWARDEDHEADERS_ENABLED: "true",
    ConnectionStrings__DefaultConnection: `Host=${db};Database=khanara;Username=postgres;Password=local-smoke-password`,
    TokenKey: "local-smoke-signing-key-".repeat(4),
    Jwt__Issuer: "http://localhost",
    Jwt__Audience: "http://localhost",
    Cors__AllowedOrigins__0: "http://localhost",
    CloudinarySettings__CloudName: "local-smoke",
    CloudinarySettings__ApiKey: "local-smoke",
    CloudinarySettings__ApiSecret: "local-smoke",
    Stripe__SecretKey: "sk_test_local_smoke",
    Stripe__WebhookSecret: "whsec_local_smoke",
    Jobs__RunInProcess: "false",
    Jobs__OidcAudience: "http://localhost",
    Jobs__SchedulerServiceAccountEmail: "local-smoke@example.invalid",
  };
  docker(
    "run",
    "-d",
    "--name",
    app,
    "--network",
    network,
    "-p",
    "127.0.0.1::8080",
    ...Object.entries(config).flatMap(([key, value]) => [
      "-e",
      `${key}=${value}`,
    ]),
    image,
  );
  createdContainers.push(app);
  const getBase = () =>
    `http://127.0.0.1:${docker("port", app, "8080/tcp").split(":").at(-1)}`;
  let base = getBase();
  const request = (path, options = {}) =>
    fetch(base + path, {
      ...options,
      headers: { "X-Forwarded-Proto": "https", ...options.headers },
      signal: AbortSignal.timeout(10000),
    });
  await waitFor(
    async () => (await request("/health")).ok,
    "application startup and migrations",
    app,
  );
  console.log("Startup migrations and health passed.");
  const html = await (await request("/orders/7")).text();
  assert.match(html, /<app-root>/);
  const bundle = html.match(/src="(main-[^"]+\.js)"/)?.[1];
  assert.ok(bundle, "SPA includes the main bundle");
  const asset = await request(`/${bundle}`);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get("cache-control"), /immutable/);
  const credentials = {
    email: `smoke-${suffix}@example.invalid`,
    password: "LocalSmoke2026!Password",
  };
  const registered = await request("/api/account/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...credentials, displayName: "Local smoke" }),
  });
  assert.equal(registered.status, 200, await registered.text());
  const login = await request("/api/account/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie"), /refreshToken=/);
  const user = await login.json();
  assert.ok(user.token);
  hub = new HubConnectionBuilder()
    .withUrl(`${base}/hubs/order`, {
      accessTokenFactory: () => user.token,
      transport: HttpTransportType.WebSockets,
      headers: { "X-Forwarded-Proto": "https" },
    })
    .configureLogging(LogLevel.None)
    .build();
  await hub.start();
  assert.equal(hub.state, "Connected");
  await hub.stop();
  console.log(
    "SPA routes/assets, registration/login and WebSocket handshake passed.",
  );
  // Restarting the exact image exercises idempotent migrations and durable data.
  docker("restart", app);
  // Docker can reassign an automatically published host port on restart.
  base = getBase();
  await waitFor(async () => (await request("/health")).ok, "restart", app);
  const secondLogin = await request("/api/account/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  assert.equal(secondLogin.status, 200);
  console.log(
    "Container smoke passed: PostgreSQL 17 migrations, SPA route/assets, authentication, WebSocket handshake, restart persistence.",
  );
} catch (error) {
  if (createdContainers.includes(app))
    console.error(docker("logs", "--tail", "30", app));
  throw error;
} finally {
  await hub?.stop().catch(() => {});
  for (const container of createdContainers.reverse())
    docker("rm", "-f", "-v", container);
  if (createdNetwork) docker("network", "rm", network);
}
