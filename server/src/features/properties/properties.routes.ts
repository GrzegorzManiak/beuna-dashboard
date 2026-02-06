import type { FastifyPluginAsync } from "fastify";
import {
    listPropertiesHandler,
    createPropertyHandler,
    getPropertyHandler,
    updatePropertyHandler,
} from "@feature/properties/properties.handlers";

const propertySummarySchema = {
    type: "object",
    properties: {
        id: { type: "string", format: "uuid" },
        propertyNumber: { type: "integer" },
        name: { type: "string" },
        managementType: { type: "string", enum: ["WEG", "MV"] },
        status: { type: "string", enum: ["DRAFT", "ACTIVE"] },
        relation: { type: "string", enum: ["MANAGER", "ACCOUNTANT"] },
    },
    required: ["id", "propertyNumber", "name", "managementType", "status", "relation"],
    additionalProperties: false,
};

const propertyDetailSchema = {
    type: "object",
    properties: {
        id: { type: "string", format: "uuid" },
        propertyNumber: { type: "integer" },
        name: { type: "string" },
        managementType: { type: "string", enum: ["WEG", "MV"] },
        status: { type: "string", enum: ["DRAFT", "ACTIVE"] },
        managerId: { type: "string", format: "uuid" },
        accountantId: { type: "string", format: "uuid" },
    },
    required: [
        "id",
        "propertyNumber",
        "name",
        "managementType",
        "status",
        "managerId",
        "accountantId",
    ],
    additionalProperties: false,
};

const propertiesRoutes: FastifyPluginAsync = async (app) => {
    app.get("/", {
        schema: {
            tags: ["properties"],
            summary: "List properties for the dashboard. Only returns properties where the user is a manager or accountant.",
            response: {
                200: {
                    type: "object",
                    properties: {
                        properties: {
                            type: "array",
                            items: propertySummarySchema,
                        },
                    },
                    required: ["properties"],
                    additionalProperties: false,
                },
            },
        },
    }, listPropertiesHandler);

    app.post("/", {
        schema: {
            tags: ["properties"],
            summary: "Create a draft property.",
            body: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    managementType: { type: "string", enum: ["WEG", "MV"] },
                    managerId: { type: "string", format: "uuid" },
                    accountantId: { type: "string", format: "uuid" },
                },
                required: ["name", "managementType", "managerId", "accountantId"],
                additionalProperties: false,
            },
            response: {
                201: {
                    type: "object",
                    properties: {
                        property: propertyDetailSchema,
                    },
                    required: ["property"],
                    additionalProperties: false,
                },
            },
        },
    }, createPropertyHandler);

    app.get("/:propertyId", {
        schema: {
            tags: ["properties"],
            summary: "Get a property by id.",
            params: {
                type: "object",
                properties: {
                    propertyId: { type: "string", format: "uuid" },
                },
                required: ["propertyId"],
                additionalProperties: false,
            },
            response: {
                200: {
                    type: "object",
                    properties: {
                        property: propertyDetailSchema,
                    },
                    required: ["property"],
                    additionalProperties: false,
                },
                404: {
                    type: "object",
                    properties: { error: { type: "string" } },
                    required: ["error"],
                    additionalProperties: false,
                },
            },
        },
    }, getPropertyHandler);

    app.patch("/:propertyId", {
        schema: {
            tags: ["properties"],
            summary: "Update property general info.",
            params: {
                type: "object",
                properties: {
                    propertyId: { type: "string", format: "uuid" },
                },
                required: ["propertyId"],
                additionalProperties: false,
            },
            body: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    managementType: { type: "string", enum: ["WEG", "MV"] },
                    managerId: { type: "string", format: "uuid" },
                    accountantId: { type: "string", format: "uuid" },
                    status: { type: "string", enum: ["DRAFT", "ACTIVE"] },
                },
                minProperties: 1,
                additionalProperties: false,
            },
            response: {
                200: {
                    type: "object",
                    properties: {
                        property: propertyDetailSchema,
                    },
                    required: ["property"],
                    additionalProperties: false,
                },
                400: {
                    type: "object",
                    properties: { error: { type: "string" } },
                    required: ["error"],
                    additionalProperties: false,
                },
                404: {
                    type: "object",
                    properties: { error: { type: "string" } },
                    required: ["error"],
                    additionalProperties: false,
                },
            },
        },
    }, updatePropertyHandler);
};

export {
    propertiesRoutes,
};
