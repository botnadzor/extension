import * as React from "react";
import ReactDOM from "react-dom/client";

import type { ContentId } from "@/shared/@model/primitives";
import { RadixPortalContainer } from "@/shared/@ui-primitives/radix-portal-container";
import isolatedUiStyling from "@/shared/isolated-ui-styling.css?inline";
import { cn } from "@/shared/tailwindcss-helpers";
import { type ContentScriptContext, createShadowRootUi } from "#imports";

import { ContentIdContext } from "./content-id-context";
import { Inspector } from "./in-page-app/inspector";
import { Toasts } from "./in-page-app/toasts";

function InPageApp({
  contentId,
  darkTheme,
}: {
  contentId: ContentId;
  darkTheme: boolean;
}) {
  return (
    <ContentIdContext value={contentId}>
      <div className={cn("font-ubuntu", darkTheme ? "dark-theme" : undefined)}>
        <React.Suspense>
          <Toasts />
        </React.Suspense>
        <React.Suspense>
          <Inspector />
        </React.Suspense>
        <RadixPortalContainer />
      </div>
    </ContentIdContext>
  );
}

export async function startInPageApp(
  contentId: ContentId,
  ctx: ContentScriptContext,
) {
  const ui = await createShadowRootUi(ctx, {
    name: "botnadzor-in-page-app",
    position: "inline",
    anchor: "body",
    css: isolatedUiStyling,

    onMount: (container) => {
      const root = ReactDOM.createRoot(container);

      const elementWithScheme = document.querySelector(
        "[scheme='vkcom_dark'], [scheme='vkcom_light']",
      );

      function renderInPageApp() {
        const darkTheme =
          elementWithScheme?.getAttribute("scheme") === "vkcom_dark";

        root.render(<InPageApp contentId={contentId} darkTheme={darkTheme} />);
      }

      renderInPageApp();

      const observer = new MutationObserver(renderInPageApp);

      if (elementWithScheme) {
        observer.observe(elementWithScheme, {
          attributes: true,
          attributeFilter: ["scheme"],
        });
      }

      return { root, observer };
    },

    onRemove: (mounted) => {
      if (mounted) {
        mounted.root.unmount();
        mounted.observer.disconnect();
      }
    },
  });

  ui.mount();
}
