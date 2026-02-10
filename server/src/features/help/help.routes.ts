import type { FastifyPluginAsync } from "fastify";
import { apiStatusHandler } from "@feature/help/help.handlers";

const helpRoutes: FastifyPluginAsync = async (app) => {
    app.get("/apistatus", {
        schema: {
            tags: ["help"],
            summary: "Provide basic API status and OpenAPI metadata.",
            response: {
                200: {
                    type: "object",
                    properties: {
                        status: { type: "string" },
                        timestamp: { type: "number" },
                        docsUrl: { type: "string" },
                        openApiUrl: { type: "string" },
                        api: {
                            type: "object",
                            properties: {
                                title: { type: "string" },
                                version: { type: "string" },
                                description: { type: "string" },
                            },
                            required: ["title", "version"],
                            additionalProperties: false,
                        },
                    },
                    required: ["status", "timestamp", "api", "docsUrl", "openApiUrl"],
                    additionalProperties: false,
                },
            },
        },
    }, apiStatusHandler);
};

export {
    helpRoutes,
};
