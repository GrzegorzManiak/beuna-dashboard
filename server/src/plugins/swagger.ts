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
        },
    });

    await app.register(swaggerUI, {
        routePrefix: "/docs",
    });
});


export {
    SwaggerPlugin,
}