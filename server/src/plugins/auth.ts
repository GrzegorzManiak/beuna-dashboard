import { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";

import fp from "fastify-plugin";

type AuthPluginOpts = {
    allowDevFallback?: boolean;
    devFallbackUserEmail?: string;
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Main auth plugin that checks for session ID in headers and 
// validates it against the database.
async function handleSessionAuth(
    app: FastifyInstance,
    req: FastifyRequest,
    reply: FastifyReply,
    sessionId: string,
    strict: boolean
): Promise<boolean> {
    if (!UUID_RE.test(sessionId)) {
        if (strict) {
            reply.code(401).send({ error: "Invalid session" });
            reply.hijack();
            return true;
        }
        return false;
    }

    const session = await app.db.session.findUnique({
        where: { id: sessionId },
        include: { user: true },
    });

    if (!session) {
        if (strict) {
            reply.code(401).send({ error: "Invalid session" });
            reply.hijack();
            return true;
        }
        return false;
    }

    void app.db.session.update({
        where: { id: session.id },
        data: { lastSeen: new Date() },
    });

    req.sessionId = session.id;
    req.user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
    };

    return true;
}

// In development, if no session ID is provided, we can optionally
// allow a fallback user for easier testing.
async function handleDevFallbackAuth(
    app: FastifyInstance,
    req: FastifyRequest,
    reply: FastifyReply,
    opts: AuthPluginOpts
): Promise<boolean> {
    if (!opts.allowDevFallback) return false;

    const email = opts.devFallbackUserEmail ?? "admin@buena.local";
    const user = await app.db.user.findUnique({ where: { email } });
    if (!user) return false;

    const session = await app.db.session.create({
        data: { userId: user.id },
    });

    req.sessionId = session.id;
    req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
    };

    reply.header("x-session-id", session.id);
    return true;
}

async function requireAuth(
    req: FastifyRequest,
    reply: FastifyReply
): Promise<FastifyReply | void> {
    if (reply.sent) return reply;
    if (req.user) return;

    const response = reply.code(401).send({ error: "Unauthorized" });
    reply.hijack();
    return response;
}

async function authPlugin(app: FastifyInstance, opts: AuthPluginOpts): Promise<void> {

    // @ts-expect-error
    app.decorateRequest("user", null);
    // @ts-expect-error
    app.decorateRequest("sessionId", null);

    app.addHook("onRoute", (route) => {
        if (!route.config?.authRequired) return;

        // Dynamically add the SessionAuth security scheme to routes 
        // that require auth, for Swagger reasons, makes things just easier
        route.schema = route.schema ?? {};
        if (!route.schema.security) route.schema.security = [{ SessionAuth: [] }];
        else if (Array.isArray(route.schema.security)) {
            const hasSessionAuth = route.schema.security
                .some((entry) => Object.prototype.hasOwnProperty.call(entry, "SessionAuth"));
            if (!hasSessionAuth) route.schema.security.push({ SessionAuth: [] });
        }

        const existing = route.preHandler;
        if (!existing) {
            route.preHandler = requireAuth;
            return;
        }

        route.preHandler = Array.isArray(existing)
            ? [requireAuth, ...existing]
            : [requireAuth, existing];
    });

    app.addHook("preHandler", async (req, reply) => {
        const sid = req.headers["x-session-id"];
        const sessionId = Array.isArray(sid) ? sid[0] : sid;
        const requiresAuth = req.routeOptions.config?.authRequired === true;

        if (sessionId) {
            const handled = await handleSessionAuth(app, req, reply, sessionId, requiresAuth);
            if (handled) return;
        }

        if (requiresAuth) return;

        await handleDevFallbackAuth(app, req, reply, opts);
    });
}

const AuthPlugin = fp(authPlugin, { name: "auth" });

export {
    AuthPlugin,
}
