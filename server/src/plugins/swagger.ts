import fp from "fastify-plugin";

import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";

const SwaggerPlugin = fp(async (app) => {
    await app.register(swagger, {
        openapi: {
            info: {
                title: "Beuna Dashboard API",
                description: "API documentation for the Beuna Dashboard backend.",
                version: "0.0.1",
            },
            components: {
                securitySchemes: {
                    SessionAuth: {
                        type: "apiKey",
                        in: "header",
                        name: "x-session-id",
                        description: "Session ID for authentication. Obtain a session ID by creating a session via the /sessions endpoint.",
                    },
                },
            }
        },
    });

    await app.register(swaggerUI, {
        routePrefix: "/docs",
        uiConfig: {
            persistAuthorization: true,
        },
    });

    app.get("/openapi.json", async () => app.swagger());
});


export {
    SwaggerPlugin,
}
