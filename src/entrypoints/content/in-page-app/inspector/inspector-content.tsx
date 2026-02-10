import { LoaderCircleIcon } from "lucide-react";
import * as React from "react";

import {
  type InspectorAccountInfo,
  type InspectorInstanceConfig,
  type InspectorTab,
  inspectorTabSchema,
} from "@/shared/@model/inspector";
import type { VkDomain } from "@/shared/@primitives/vk";
import { useAccountInspection } from "@/shared/@ui-helpers/data-hooks";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/@ui-primitives/tabs";
import { inspectorService } from "@/shared/proxy-services";

import { useContentId } from "../../content-id-context";
import { AccountActivity } from "./account-activity";
import { OptionalMark } from "./optional-mark";
import { ReportForm } from "./report-form";

function AccountMark({ vkDomain }: { vkDomain: VkDomain }) {
  const accountInspection = useAccountInspection(vkDomain);
  if (accountInspection.problem) {
    return;
  }

  return (
    <OptionalMark
      mark={accountInspection.legacy.mark ?? undefined}
      markTitle={accountInspection.legacy.mark_title ?? undefined}
      markColor={accountInspection.legacy.mark_color ?? undefined}
    />
  );
}

function InspectedAccount({ avatarUrl, name, vkDomain }: InspectorAccountInfo) {
  return (
    <div className="flex flex-none items-center gap-2.25 pb-1">
      <img
        src={avatarUrl}
        alt={name}
        className="size-5.5 translate-x-0.5 rounded-full bg-border"
      />
      <span className="text-lg">{name}</span>
      <React.Suspense>
        <AccountMark vkDomain={vkDomain} />
      </React.Suspense>
    </div>
  );
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
  accountInfo,
  trigger,
  tab,
}: InspectorInstanceConfig) {
  const contentId = useContentId();
  return (
    <>
      <InspectedAccount {...accountInfo} />
      <Tabs
        activationMode="manual"
        value={tab}
        onValueChange={(value) => {
          void inspectorService.setTab(
            contentId,
            inspectorTabSchema.parse(value),
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
          <TabsTrigger
            value={"activity" satisfies InspectorTab}
            className="px-2.5"
          >
            Обнаруженная активность
          </TabsTrigger>
          <TabsTrigger
            value={"report" satisfies InspectorTab}
            className="px-2.5"
          >
            Отправить на проверку
          </TabsTrigger>
        </TabsList>
        <InspectorTabsContent value="activity">
          <React.Suspense fallback={<TabLoader />}>
            <AccountActivity vkDomain={accountInfo.vkDomain} />
          </React.Suspense>
        </InspectorTabsContent>
        <InspectorTabsContent value="report">
          <React.Suspense fallback={<TabLoader />}>
            <ReportForm vkDomain={accountInfo.vkDomain} trigger={trigger} />
          </React.Suspense>
        </InspectorTabsContent>
      </Tabs>
    </>
  );
}
