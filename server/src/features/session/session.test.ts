import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "@app";
import { UserRole } from "@prisma/client";

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "MANAGER" | "ACCOUNTANT";
};

type SessionResponse = {
  sessionId: string;
  createdAt: string;
  lastSeen: string;
  user: SessionUser;
};

type CreateSessionResponse = {
  sessionId: string;
};

describe("sessions routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let userId = "";

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    const created = await app.db.user.create({
      data: {
        email: `session-test-${Date.now()}@buena.local`,
        name: "Session User",
        role: UserRole.MANAGER,
      },
      select: { id: true },
    });

    userId = created.id;
  });

  afterAll(async () => {
    if (userId) await app.db.user.delete({ where: { id: userId } }).catch(() => null);
    await app.close();
  });

  it("POST /sessions creates session and GET /sessions/:sessionId returns it", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/sessions",
      payload: { userId },
    });

    expect(createRes.statusCode).toBe(201);

    const createBody = createRes.json() as CreateSessionResponse;
    expect(typeof createBody.sessionId).toBe("string");

    const getRes = await app.inject({
      method: "GET",
      url: `/sessions/${createBody.sessionId}`,
    });

    expect(getRes.statusCode).toBe(200);

    const getBody = getRes.json() as SessionResponse;
    expect(getBody.sessionId).toBe(createBody.sessionId);
    expect(getBody.user.id).toBe(userId);
  });

  it("GET /sessions/me returns session for header", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/sessions",
      payload: { userId },
    });

    expect(createRes.statusCode).toBe(201);

    const createBody = createRes.json() as CreateSessionResponse;

    const meRes = await app.inject({
      method: "GET",
      url: "/sessions/me",
      headers: { "x-session-id": createBody.sessionId },
    });

    expect(meRes.statusCode).toBe(200);

    const meBody = meRes.json() as SessionResponse;
    expect(meBody.sessionId).toBe(createBody.sessionId);
    expect(meBody.user.id).toBe(userId);
  });
});
