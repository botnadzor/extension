import Markdown from "marked-react";
import semverSatisfies from "semver/functions/satisfies";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/@ui-primitives/accordion";
import { getAppConfig } from "@/shared/app-config";
import { formatDate } from "@/shared/formatting";
import {
  useFrontendBaseUrl,
  useStaticListItems,
} from "@/shared/pollable-value-hooks";

export function AnnouncementsTabBody() {
  const announcements = useStaticListItems("announcements");
  const frontendBaseUrl = useFrontendBaseUrl();

  const announcementsToShow = announcements
    .filter(({ extensionVersionRange }) =>
      semverSatisfies(getAppConfig().extensionVersion, extensionVersionRange, {
        includePrerelease: true,
      }),
    )
    .toReversed();

  return (
    <div className="px-3 pt-2 pb-4">
      <Accordion type="multiple">
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
                  text-sm
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
