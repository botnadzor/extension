import * as React from "react";

import { Logo } from "@/components/logo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useContentId } from "@/hooks/content-id-context";
import { useFrontendBaseUrl } from "@/hooks/frontend-service";
import { useInspectorInstanceConfig } from "@/hooks/inspector-service";
import { useAuthStatus } from "@/hooks/user-service";
import { inspectorService } from "@/lib/proxy-services";

import { InspectorContent } from "./inspector/inspector-content";

function PointsRemaining() {
  const authStatus = useAuthStatus();

  if (authStatus.state !== "valid" || authStatus.accessLevel > 0) {
    return;
  }

  return (
    <div
      className="
        absolute top-5 right-13 font-ubuntu text-xs font-normal
        text-muted-foreground
      "
    >
      <p>
        Осталось очков:{" "}
        <span className="pl-0.5 tabular-nums">
          {authStatus.pointCount.toLocaleString("ru-RU")}
        </span>
      </p>
    </div>
  );
}

export function Inspector() {
  const contentId = useContentId();
  const frontendBaseUrl = useFrontendBaseUrl();
  const inspectorInstanceConfig = useInspectorInstanceConfig(contentId);

  function handleOpenChange(open: boolean) {
    if (!open) {
      void inspectorService.trigger(contentId, undefined);
    }
  }

  return (
    <Dialog
      open={Boolean(inspectorInstanceConfig)}
      onOpenChange={handleOpenChange}
    >
      <DialogContent
        className="
          flex h-100 flex-col gap-2 pt-3 pb-0
          data-[state=inactive]:hidden
          sm:max-w-150
        "
      >
        <DialogHeader className="flex-0">
          <DialogTitle className="-mb-1 flex items-center gap-2">
            <a
              href={frontendBaseUrl}
              target="_blank"
              rel="noreferrer"
              className="-mx-0.5 p-0.5 u-ring"
            >
              <Logo />
            </a>
            <span className="mt-0.5 size-1.5 rounded-full bg-muted-foreground" />
            <h1 className="mb-0.5 text-2xl text-muted-foreground">Инспектор</h1>
            <React.Suspense>
              <PointsRemaining />
            </React.Suspense>
            <div className="sr-only">(анализ аккаунта VK)</div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Ботнадзор: подсветка ботов
          </DialogDescription>
        </DialogHeader>

        {inspectorInstanceConfig?.commenterVkDomain && (
          <InspectorContent {...inspectorInstanceConfig} />
        )}
      </DialogContent>
    </Dialog>
  );
}
