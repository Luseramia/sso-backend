import { boolean, integer, pgTable, varchar } from "drizzle-orm/pg-core";
import { helper } from "./helper.schema";

export const fileUploadTable = pgTable("file_upload", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  file_name: varchar({ length: 200 }).notNull(),
  create_by_user_id: integer(),
  original_file_name: varchar({ length: 200 }).notNull(),
  file_category: varchar({ length: 50 }).default("video").notNull(),
  is_public: boolean().default(false).notNull(),
  ...helper,
});

// const relations = defineRelations({ usersTable, fileUploadTable }, (r:RelationConfig<any,any>) => ({
//   posts: {
//     author: r.one.users({
//       from: r.posts.ownerId,
//       to: r.users.id,
//     }),
//   },
// }));
