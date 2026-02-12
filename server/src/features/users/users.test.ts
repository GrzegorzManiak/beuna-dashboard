import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "@app";
import { UserRole } from "@prisma/client";

type UserShape = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "MANAGER" | "ACCOUNTANT";
  createdAt: string;
  updatedAt: string;
};

type UsersListResponse = {
  users: UserShape[];
};

type UserResponse = {
  user: UserShape;
};

describe("users routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let userId = "";
  let userEmail = "";

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    userEmail = `test-${Date.now()}@buena.local`;
    const created = await app.db.user.create({
      data: {
        email: userEmail,
        name: "Test User",
        role: UserRole.ADMIN,
      },
      select: { id: true },
    });

    userId = created.id;
  });

  afterAll(async () => {
    if (userId) await app.db.user.delete({ where: { id: userId } }).catch(() => null);
    await app.close();
  });

  it("GET /users returns users list", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/users",
    });

    expect(res.statusCode).toBe(200);

    const body = res.json() as UsersListResponse;
    expect(Array.isArray(body.users)).toBe(true);

    const match = body.users.find((user) => user.id === userId);
    expect(Boolean(match)).toBe(true);
  });

  it("GET /users ignores invalid session header", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/users",
      headers: { "x-session-id": "not-a-real-session-id" },
    });

    expect(res.statusCode).toBe(200);

    const body = res.json() as UsersListResponse;
    expect(Array.isArray(body.users)).toBe(true);
  });

  it("GET /users/:userId returns user", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/users/${userId}`,
    });

    expect(res.statusCode).toBe(200);

    const body = res.json() as UserResponse;
    expect(body.user.id).toBe(userId);
    expect(body.user.email).toBe(userEmail);
  });
});
