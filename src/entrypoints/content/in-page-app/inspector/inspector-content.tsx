import { LoaderCircleIcon } from "lucide-react";
import * as React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useContentId } from "@/hooks/content-id-context";
import { useAccountInspection } from "@/hooks/inspector-service";
import type { VkDomain } from "@/lib/primitive-values";
import { inspectorService } from "@/lib/proxy-services";
import type {
  InspectorInstanceConfig,
  InspectorTab,
} from "@/services/inspector-service";

import { AccountActivity } from "./account-activity";
import { OptionalMark } from "./optional-mark";
import { ReportForm } from "./report-form";

function AccountMark({ vkDomain }: { vkDomain: VkDomain }) {
  const accountInspection = useAccountInspection(vkDomain);
  if (!accountInspection.success) {
    return;
  }

  return <OptionalMark {...accountInspection.data} />;
}

function InspectorTabsContent({
  children,
  value,
}: {
  children: React.ReactNode;
  value: string;
}) {
  return (
    <TabsContent
      value={value}
      className="relative -mx-4 mt-px flex-1 u-no-ring"
      tabIndex={-1}
    >
      {children}
    </TabsContent>
  );
}

function TabLoader() {
  return (
    <div className="absolute inset-0 bottom-4 flex items-center justify-center">
      <LoaderCircleIcon className="size-8 animate-spin text-muted-foreground fade-in" />
    </div>
  );
}

export function InspectorContent({
  commenterVkDomain,
  commenterName,
  commenterAvatarUrl,
  tab,
}: InspectorInstanceConfig) {
  const contentId = useContentId();
  return (
    <>
      <div className="flex flex-none items-center gap-2.25 pb-1">
        <img
          src={commenterAvatarUrl}
          alt={commenterName}
          className="size-5.5 rounded-full bg-border"
        />
        <span className="text-lg">{commenterName}</span>
        <React.Suspense>
          <AccountMark vkDomain={commenterVkDomain} />
        </React.Suspense>
      </div>
      <Tabs
        activationMode="manual"
        value={tab}
        onValueChange={(value) => {
          void inspectorService.setTab(
            contentId,
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- protected by `satisfies`
            value as InspectorTab,
          );
        }}
        className="flex flex-1 flex-col"
      >
        <TabsList
          className="
            -mx-1 inline-flex h-auto flex-none self-start
            *:h-8
          "
        >
          <TabsTrigger value={"activity" satisfies InspectorTab}>
            обнаруженная активность
          </TabsTrigger>
          <TabsTrigger value={"report" satisfies InspectorTab}>
            отправить на проверку
          </TabsTrigger>
        </TabsList>
        <InspectorTabsContent value="activity">
          <React.Suspense fallback={<TabLoader />}>
            <AccountActivity vkDomain={commenterVkDomain} />
          </React.Suspense>
        </InspectorTabsContent>
        <InspectorTabsContent value="report">
          <React.Suspense fallback={<TabLoader />}>
            <ReportForm vkDomain={commenterVkDomain} />
          </React.Suspense>
        </InspectorTabsContent>
      </Tabs>
    </>
  );
}
