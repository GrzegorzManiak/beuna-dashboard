import type { FastifyPluginAsync } from "fastify";
import { healthHandler, readinessHandler } from "./health.handlers";

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", healthHandler);
  app.get("/ready", readinessHandler);
};

export {
  healthRoutes,
}