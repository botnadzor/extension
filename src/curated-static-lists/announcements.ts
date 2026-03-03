import type { z } from "zod/mini";

import type { storedAnnouncementListItemSchema } from "@/shared/@model/static-lists/=announcements";

export default [
  {
    createdAt: "2026-01-11T21:00:00Z",
    extensionVersionRange: "*",
    header: "Расширение обновлено до альфа-версии 2.0",
    content:
      "Рады представить вам новую версию расширения! В ней мы переработали внутреннее устройство функционирования расширения и подготовили его для работы с постоянно растущим количеством аккаунтов для подсветки",
  },
] satisfies Array<z.input<typeof storedAnnouncementListItemSchema>>;
