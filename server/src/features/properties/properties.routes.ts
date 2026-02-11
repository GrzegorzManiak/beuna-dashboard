import type { FastifyPluginAsync } from "fastify";
import {
    listPropertiesHandler,
    createPropertyHandler,
    getPropertyDocumentHandler,
    getPropertyHandler,
    getPropertySectionsStreamHandler,
    updatePropertyHandler,
    classifySectionHandler,
    extractSectionFieldsHandler,
    createPropertySectionHandler,
    updatePropertySectionHandler,
    deletePropertySectionHandler,
} from "@feature/properties/properties.handlers";

const propertySummarySchema = {
    type: "object",
    properties: {
        id: { type: "string", format: "uuid" },
        propertyNumber: { type: "integer" },
        name: { type: "string" },
        managementType: { type: "string", enum: ["UNKNOWN", "WEG", "MV"] },
        status: { type: "string", enum: ["DRAFT", "ACTIVE"] },
        relation: { type: "string", enum: ["MANAGER", "ACCOUNTANT"] },
        buildingCount: { type: "integer" },
    },
    required: ["id", "propertyNumber", "name", "managementType", "status", "relation", "buildingCount"],
    additionalProperties: false,
};

const propertyDetailSchema = {
    type: "object",
    properties: {
        id: { type: "string", format: "uuid" },
        propertyNumber: { type: "integer" },
        name: { type: "string" },
        managementType: { type: "string", enum: ["UNKNOWN", "WEG", "MV"] },
        status: { type: "string", enum: ["DRAFT", "ACTIVE"] },
        managerId: { type: ["string", "null"], format: "uuid" },
        accountantId: { type: ["string", "null"], format: "uuid" },
        addressStreet: { type: ["string", "null"] },
        addressPostalCode: { type: ["string", "null"] },
        addressCity: { type: ["string", "null"] },
    },
    required: [
        "id",
        "propertyNumber",
        "name",
        "managementType",
        "status",
        "managerId",
        "accountantId",
        "addressStreet",
        "addressPostalCode",
        "addressCity",
    ],
    additionalProperties: false,
};

const sectionPositionSchema = {
    type: "object",
    properties: {
        page: { type: "integer" },
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
    },
    required: ["page", "x", "y", "width", "height"],
    additionalProperties: false,
};

const basicDetailsFieldSchema = {
    type: "object",
    properties: {
        key: { type: "string" },
        value: { type: ["string", "null"] },
        sourceText: { type: ["string", "null"] },
        sectionIndex: { type: ["integer", "null"] },
        position: {
            anyOf: [
                sectionPositionSchema,
                { type: "null" },
            ],
        },
    },
    required: ["key", "value", "sourceText", "sectionIndex", "position"],
    additionalProperties: false,
};

const basicDetailsSchema = {
    anyOf: [
        { type: "null" },
        {
            type: "object",
            properties: {
                fields: {
                    type: "array",
                    items: basicDetailsFieldSchema,
                },
            },
            required: ["fields"],
            additionalProperties: false,
        },
    ],
};

const secureConfig = { authRequired: true };

const propertiesRoutes: FastifyPluginAsync = async (app) => {
    app.get("/", {
        config: secureConfig,
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
        config: secureConfig,
        schema: {
            tags: ["properties"],
            summary: "Create a draft property from a PDF upload.",
            consumes: ["multipart/form-data"],
            response: {
                201: {
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
            },
        },
    }, createPropertyHandler);

    app.get("/:propertyId", {
        config: secureConfig,
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

    app.get("/:propertyId/sections/stream", {
        websocket: true,
        schema: {
            tags: ["properties"],
            summary: "Stream extracted sections for a property via WebSocket.",
            params: {
                type: "object",
                properties: {
                    propertyId: { type: "string", format: "uuid" },
                },
                required: ["propertyId"],
                additionalProperties: false,
            },
            querystring: {
                type: "object",
                properties: {
                    sessionId: { type: "string" },
                },
                required: ["sessionId"],
                additionalProperties: false,
            },
        },
    }, getPropertySectionsStreamHandler);

    app.get("/:propertyId/document", {
        config: secureConfig,
        schema: {
            tags: ["properties"],
            summary: "Get the uploaded PDF document for a property.",
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
                    type: "string",
                    format: "binary",
                },
                404: {
                    type: "object",
                    properties: { error: { type: "string" } },
                    required: ["error"],
                    additionalProperties: false,
                },
            },
        },
    }, getPropertyDocumentHandler);

    app.patch("/:propertyId", {
        config: secureConfig,
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
                    addressStreet: { type: ["string", "null"] },
                    addressPostalCode: { type: ["string", "null"] },
                    addressCity: { type: ["string", "null"] },
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

    app.post("/:propertyId/classify-section", {
        config: secureConfig,
        schema: {
            tags: ["properties"],
            summary: "Classify a user-selected text section.",
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
                    text: { type: "string" },
                    heading: { type: "string" },
                },
                required: ["text"],
                additionalProperties: false,
            },
            response: {
                200: {
                    type: "object",
                    properties: {
                        sectionType: { type: "string" },
                        confidence: { type: "number" },
                    },
                    required: ["sectionType", "confidence"],
                    additionalProperties: false,
                },
                400: {
                    type: "object",
                    properties: { error: { type: "string" } },
                    required: ["error"],
                    additionalProperties: false,
                },
                401: {
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
                500: {
                    type: "object",
                    properties: { error: { type: "string" }, sectionType: { type: "string" }, confidence: { type: "number" } },
                    required: ["sectionType", "confidence"],
                    additionalProperties: false,
                },
            },
        },
    }, classifySectionHandler);

    app.post("/:propertyId/sections/:sectionId/extract", {
        config: secureConfig,
        schema: {
            tags: ["properties"],
            summary: "Extract structured field values from a section using LLM.",
            params: {
                type: "object",
                properties: {
                    propertyId: { type: "string", format: "uuid" },
                    sectionId: { type: "string" },
                },
                required: ["propertyId", "sectionId"],
                additionalProperties: false,
            },
            body: {
                type: "object",
                properties: {
                    rawText: { type: "string" },
                    sectionType: { type: "string" },
                    buildings: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                uuid: { type: "string" },
                                name: { type: "string" },
                            },
                            required: ["uuid", "name"],
                            additionalProperties: false,
                        },
                    },
                },
                required: ["rawText", "sectionType"],
                additionalProperties: false,
            },
            response: {
                200: {
                    type: "object",
                    properties: {
                        sectionId: { type: "string" },
                        fields: { type: "object", additionalProperties: true },
                        elapsedMs: { type: "number" },
                    },
                    required: ["sectionId", "fields"],
                    additionalProperties: false,
                },
                400: {
                    type: "object",
                    properties: { error: { type: "string" } },
                    required: ["error"],
                    additionalProperties: false,
                },
                401: {
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
                500: {
                    type: "object",
                    properties: { error: { type: "string" } },
                    required: ["error"],
                    additionalProperties: false,
                },
            },
        },
    }, extractSectionFieldsHandler);

    app.post("/:propertyId/sections", {
        config: secureConfig,
        schema: {
            tags: ["properties"],
            summary: "Create a user-drawn section for a property.",
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
                    headingText: { type: "string" },
                    rawText: { type: "string" },
                    textPosition: {},
                    sectionType: { type: "string" },
                    confidence: { type: "number" },
                    state: { type: "string" },
                    fields: { type: "object", additionalProperties: true },
                },
                required: ["textPosition"],
                additionalProperties: false,
            },
            response: {
                201: {
                    type: "object",
                    properties: {
                        section: {
                            type: "object",
                            additionalProperties: true,
                        },
                    },
                    required: ["section"],
                    additionalProperties: false,
                },
                400: {
                    type: "object",
                    properties: { error: { type: "string" } },
                    required: ["error"],
                    additionalProperties: false,
                },
                401: {
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
    }, createPropertySectionHandler);

    app.patch("/:propertyId/sections/:sectionId", {
        config: secureConfig,
        schema: {
            tags: ["properties"],
            summary: "Update a section (state, fields, sectionType, etc.).",
            params: {
                type: "object",
                properties: {
                    propertyId: { type: "string", format: "uuid" },
                    sectionId: { type: "string" },
                },
                required: ["propertyId", "sectionId"],
                additionalProperties: false,
            },
            body: {
                type: "object",
                properties: {
                    sectionType: { type: "string" },
                    confidence: { type: "number" },
                    state: { type: "string" },
                    fields: {},
                    rawText: { type: "string" },
                    headingText: { type: "string" },
                    items: {},
                },
                minProperties: 1,
                additionalProperties: false,
            },
            response: {
                200: {
                    type: "object",
                    properties: {
                        section: {
                            type: "object",
                            additionalProperties: true,
                        },
                    },
                    required: ["section"],
                    additionalProperties: false,
                },
                400: {
                    type: "object",
                    properties: { error: { type: "string" } },
                    required: ["error"],
                    additionalProperties: false,
                },
                401: {
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
    }, updatePropertySectionHandler);

    app.delete("/:propertyId/sections/:sectionId", {
        config: secureConfig,
        schema: {
            tags: ["properties"],
            summary: "Delete a section.",
            params: {
                type: "object",
                properties: {
                    propertyId: { type: "string", format: "uuid" },
                    sectionId: { type: "string" },
                },
                required: ["propertyId", "sectionId"],
                additionalProperties: false,
            },
            response: {
                204: {
                    type: "null",
                    description: "Section deleted.",
                },
                401: {
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
    }, deletePropertySectionHandler);
};

export {
    propertiesRoutes,
};
