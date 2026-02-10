import type { FastifyReply, FastifyRequest } from "fastify";

type OpenApiInfo = {
    title: string;
    version: string;
    description?: string;
};

type OpenApiSpec = {
    info?: OpenApiInfo;
};

type ApiStatusResponse = {
    status: "ok";
    timestamp: number;
    api: {
        title: string;
        version: string;
        description?: string;
    };
    docsUrl: string;
    openApiUrl: string;
};

async function apiStatusHandler(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const swagger = req.server.swagger() as OpenApiSpec;
    const info = swagger.info ?? { title: "Beuna Dashboard API", version: "unknown" };

    await reply.send({
        status: "ok",
        timestamp: Date.now(),
        api: {
            title: info.title,
            version: info.version,
            description: info.description,
        },
        docsUrl: "/docs",
        openApiUrl: "/openapi.json",
    } satisfies ApiStatusResponse);
}

export {
    apiStatusHandler,
};
