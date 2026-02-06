import { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";

import fp from "fastify-plugin";

type AuthPluginOpts = {
    allowDevFallback?: boolean;
    devFallbackUserEmail?: string;
};

// Main auth plugin that checks for session ID in headers and 
// validates it against the database.
async function handleSessionAuth(
    app: FastifyInstance,
    req: FastifyRequest,
    reply: FastifyReply,
    sessionId: string
): Promise<boolean> {
    const session = await app.db.session.findUnique({
        where: { id: sessionId },
        include: { user: true },
    });

    if (!session) {
        await reply.status(401).send({ error: "Invalid session" });
        return true;
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

async function authPlugin(app: FastifyInstance, opts: AuthPluginOpts): Promise<void> {
    app.addHook("preHandler", async (req, reply) => {
        const sid = req.headers["x-session-id"];
        const sessionId = Array.isArray(sid) ? sid[0] : sid;

        if (sessionId) {
            const handled = await handleSessionAuth(app, req, reply, sessionId);
            if (handled) return;
        }

        await handleDevFallbackAuth(app, req, reply, opts);
    });
}

const AuthPlugin = fp(authPlugin, { name: "auth" });

export {
    AuthPlugin,
}
