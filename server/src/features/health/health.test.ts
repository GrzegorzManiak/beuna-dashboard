import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../app";

describe("health routes", () => {
  const ctx: { app: Awaited<ReturnType<typeof buildApp>> } = {} as any;

  beforeAll(async () => {
    ctx.app = await buildApp();
    await ctx.app.ready();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("GET /health returns ok payload", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/health",
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.status).toBe("ok");
    expect(typeof body.uptime).toBe("number");
    expect(typeof body.timestamp).toBe("number");
  });

  it("GET /health/ready returns ready (or 503 if deps down)", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: "/health/ready",
    });

    // TODO: DB Stuff is not setup yet, will ahve to come back to this
    expect([200, 503]).toContain(res.statusCode);

    const body = res.json();
    expect(["ready", "not_ready"]).toContain(body.status);
  });
});
