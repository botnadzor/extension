import type { z } from "zod/mini";

import type { interpretedAnnouncementListItemSchema } from "@/shared/@model/static-lists/=announcements";

export default [
  // This file is a playground for testing list items.
  // Do not merge changes to this file into the main branch.
] satisfies Array<z.input<typeof interpretedAnnouncementListItemSchema>>;
