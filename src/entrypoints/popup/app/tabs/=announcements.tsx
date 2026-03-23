import Markdown from "marked-react";

import {
  useFilteredAnnouncements,
  useFrontendBaseUrl,
} from "@/shared/@ui-helpers/data-hooks";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/@ui-primitives/accordion";
import { formatDate } from "@/shared/formatting";

export function AnnouncementsTabBody() {
  const announcements = useFilteredAnnouncements("default");
  const frontendBaseUrl = useFrontendBaseUrl();

  // Show newer announcements first
  const announcementsToShow = announcements.toSorted((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <div className="px-3 pt-2 pb-4">
      <Accordion>
        {announcementsToShow.map(({ createdAt, header, content }) => (
          <AccordionItem key={createdAt} value={createdAt}>
            <AccordionTrigger>
              <div className="flex w-full flex-col items-start text-left">
                <div className="text-sm text-pretty">{header}</div>
                <div className="pt-0.5 text-xs text-muted-foreground">
                  {formatDate(createdAt)}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div
                className="
                  prose-sm
                  prose-ol:list-decimal prose-ol:pl-4
                  prose-ul:list-['–'] prose-ul:pl-2.5
                  [&_a]:u-link
                "
              >
                <Markdown baseURL={frontendBaseUrl} value={content} />
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
