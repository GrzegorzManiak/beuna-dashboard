import { type FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import websocket from "@fastify/websocket";

const WebsocketPlugin = fp(async (app: FastifyInstance) => {
    await app.register(websocket);
});

export {
    WebsocketPlugin,
}
