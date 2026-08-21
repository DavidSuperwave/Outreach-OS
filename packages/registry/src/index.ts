export {
  ENTITY_TYPES,
  ENTITY_PREFIX,
  DOCUMENT_FACETS,
  PROPERTY_ENTITY_TYPE,
  PROPERTY_TYPE_MAP,
  isEntityType,
  typeFromPrefix,
  accessEntityType,
} from "./entity-types.js";
export type { EntityType, DocumentFacet, PropertyEntityType, PropertyTypeMapping } from "./entity-types.js";
export { typedId, parseTypedId, nextId, fixtureId, resetIdSequence } from "./ids.js";
export { EntityRegistry, RegistryError } from "./registry.js";
export type { RegistryRecord } from "./registry.js";
