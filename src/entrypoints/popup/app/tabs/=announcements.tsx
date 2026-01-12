import Markdown from "marked-react";
import semverSatisfies from "semver/functions/satisfies";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useFrontendBaseUrl } from "@/hooks/frontend-service";
import { useStaticListItems } from "@/hooks/static-lists-service";
import { getAppConfig } from "@/lib/app-config";
import { formatDate } from "@/lib/formatting";

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
    <div className="pt-2 pr-3 pb-4 pl-1">
      <Accordion type="multiple">
        {announcementsToShow.map(({ createdAt, header, content }) => (
          <AccordionItem key={createdAt} value={createdAt}>
            <AccordionTrigger>
              <div className="flex w-full flex-col items-start text-left">
                <div className="text-sm text-foreground">{header}</div>
                <div className="text-xs text-muted-foreground">
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
