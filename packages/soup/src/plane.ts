import { Outbox } from "control-plane";
import { ProjectionConsumer } from "./consumer.js";
import { FavoritesIndex } from "./favorites.js";
import { SCHEMA_FAMILY_CONTRACTS } from "./schemas.js";
import { SearchIndex } from "./search-index.js";
import { SoupIndex } from "./soup-index.js";

/**
 * One projection plane (OD-27). Lists and search are schema families on the
 * same consumer; they do not share storage. Physical D1 is 4a.
 */
export class ProjectionPlane {
  readonly lists = new SoupIndex();
  readonly search = new SearchIndex();
  readonly favorites = new FavoritesIndex();
  readonly consumer = new ProjectionConsumer([this.lists, this.search]);
  readonly contracts = SCHEMA_FAMILY_CONTRACTS;

  ingest(outbox: Outbox): number {
    return this.consumer.ingest(outbox);
  }

  rebuild(outbox: Outbox): number {
    return this.consumer.rebuild(outbox);
  }
}
