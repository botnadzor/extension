import * as React from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useFrontendBaseUrl } from "@/hooks/frontend-service";
import { useActivePopupTab } from "@/hooks/popup-service";
import { getAppConfig } from "@/lib/app-config";
import { type PopupTab, popupTabs } from "@/lib/primitive-values";
import { popupService } from "@/lib/proxy-services";
import { generateUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";

import { Header } from "./app/header";
import { popupTabDefinitionLookup } from "./app/tabs";

/**
 * Display version with line breaks before "." characters.
 * This improves formatting of long work-in-progress version names
 * while still allowing the version to be copy-pasted.
 */
function Version() {
  const versionName = getAppConfig().extensionVersionName;
  const startsWithNumber = /^\d/.test(versionName);
  const shouldHaveGithubRelease = /^[2-9]/.test(versionName);

  const reactNodeWithVersion = (
    <>
      {startsWithNumber && "v"}
      {versionName.split(".").map((part, index) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key -- value does not change between rerenders
        <React.Fragment key={index}>
          {index > 0 && (
            <>
              <span className="inline-block w-0" />.
            </>
          )}
          {part}
        </React.Fragment>
      ))}
    </>
  );

  return (
    <div
      className={cn(
        `
          pr-3 pl-0.75 -indent-0.75 text-balance text-muted-foreground
          tabular-nums
        `,
        !startsWithNumber && "text-xs",
      )}
    >
      {shouldHaveGithubRelease ? (
        <a
          className="u-link-secondary"
          href={`https://github.com/botnadzor/extension/releases/tag/v${versionName}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          {reactNodeWithVersion}
        </a>
      ) : (
        reactNodeWithVersion
      )}
    </div>
  );
}

function LinksBelowNav() {
  const frontendBaseUrl = useFrontendBaseUrl();
  return (
    <div className="pl-3 text-sm">
      <Version />
      <ul className="space-y-2 pt-2">
        {[
          ["GitHub", "https://github.com/botnadzor/extension"],
          ["Справка", generateUrl(frontendBaseUrl, "/help")],
          ["Помочь проекту", generateUrl(frontendBaseUrl, "/docs/how-to-help")],
        ].map(([label, href]) => (
          <li key={label}>
            <a
              className="u-link"
              target="_blank"
              rel="noopener noreferrer"
              href={href}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tabs({ activeTab }: { activeTab?: PopupTab | undefined }) {
  const handleTabClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- assertion is valid because data-tab is set via popupTabs.map(...)
      const tab = event.currentTarget.dataset["tab"] as PopupTab;
      void popupService.setActiveTab(tab);
    },
    [],
  );

  return (
    <nav className="flex flex-col pr-3">
      {popupTabs.map((tab) => (
        <button
          type="button"
          key={tab}
          data-tab={tab}
          onClick={handleTabClick}
          className="group py-1.5 pl-3 text-left text-foreground u-no-ring"
        >
          <span
            className={cn(
              `
                block border-l-2 border-primary py-1 pl-2 text-sm
                u-ring-in-group transition-all duration-200
                group-focus-visible:rounded-xs
              `,
              activeTab !== tab &&
                `
                  border-primary/30 text-muted-foreground
                  group-hover:border-primary/70 group-hover:text-foreground
                `,
            )}
          >
            {popupTabDefinitionLookup[tab].label}
          </span>
        </button>
      ))}
    </nav>
  );
}

function StoreAwareTabs() {
  const activeTab = useActivePopupTab();

  return <Tabs activeTab={activeTab} />;
}

function ActiveTabBody() {
  const activeTab = useActivePopupTab();
  const activeTabDefinition = popupTabDefinitionLookup[activeTab];

  return <activeTabDefinition.Body />;
}

export function App() {
  return (
    <div className="absolute inset-0 flex flex-col">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-38 min-w-38 flex-0 flex-col justify-between pb-3">
          <React.Suspense fallback={<Tabs />}>
            <StoreAwareTabs />
          </React.Suspense>
          <React.Suspense>
            <LinksBelowNav />
          </React.Suspense>
        </div>

        <ScrollArea className="flex-1 grow">
          <React.Suspense>
            <ActiveTabBody />
          </React.Suspense>
        </ScrollArea>
      </div>
    </div>
  );
}
