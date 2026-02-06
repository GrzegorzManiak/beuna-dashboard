import { buildApp } from "./app";

function getPort(value: number | undefined): number {
  const port = value ?? 3000;
  if (!Number.isFinite(port)) throw new Error("PORT must be a number");
  if (port <= 0) throw new Error("PORT must be greater than 0");
  return port;
}

function getHost(value: string | undefined): string {
  const host = value?.trim();
  if (!host) return "0.0.0.0";
  return host;
}

async function startServer(): Promise<void> {
  const app = await buildApp();
  const port = getPort(app.config.PORT);
  const host = getHost(process.env.HOST);
  await app.listen({ port, host });
}

startServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});