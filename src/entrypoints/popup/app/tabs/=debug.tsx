import * as React from "react";

import { baseExtensionVersionInfo } from "@/shared/@model/extension-version";
import { popupService } from "@/shared/proxy-services";

export function DebugTabBody() {
  return (
    <div className="px-3 pt-2.5 pb-3">
      <div className="text-sm">
        На этой вкладке будут выведены логи (технический журнал событий)
      </div>
    </div>
  );
}

export function DebugTabWrapper({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const [shownBefore, setShownBefore] = React.useState(false);

  if (!shownBefore && active) {
    setShownBefore(true);
  }

  const shown =
    active || shownBefore || baseExtensionVersionInfo.lifecycle !== "release";

  return (
    <>
      {shown && children}
      <div
        className="
          flex-1
          focus:outline-none
        "
        role="button"
        tabIndex={-1}
        onDoubleClick={() => {
          void popupService.setActiveTab("debug");
        }}
      />
    </>
  );
}
