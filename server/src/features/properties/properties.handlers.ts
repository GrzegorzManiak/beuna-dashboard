/**
 * Barrel re-export — individual handlers live in their own files:
 *
 *   properties.list.handlers.ts      — listPropertiesHandler
 *   properties.create.handlers.ts    — createPropertyHandler
 *   properties.get.handlers.ts       — getProperty*, stream, document
 *   properties.update.handlers.ts    — updatePropertyHandler
 *   properties.delete.handlers.ts    — deletePropertyHandler
 *   properties.sections.handlers.ts  — create/update/delete section
 *   properties.extract.handlers.ts   — classify + extract fields
 */

export { listPropertiesHandler } from "./properties.list.handlers";
export { createPropertyHandler } from "./properties.create.handlers";
export {
    getPropertyDocumentHandler,
    getPropertyHandler,
    getPropertySectionsHandler,
    getPropertySectionsStreamHandler,
} from "./properties.get.handlers";
export { updatePropertyHandler } from "./properties.update.handlers";
export { deletePropertyHandler } from "./properties.delete.handlers";
export {
    classifySectionHandler,
    extractSectionFieldsHandler,
} from "./properties.extract.handlers";
export {
    createPropertySectionHandler,
    updatePropertySectionHandler,
    deletePropertySectionHandler,
} from "./properties.sections.handlers";

