import * as React from "react";
import ReactDOM from "react-dom/client";

import { RadixPortalContainer } from "@/components/ui/radix-portal-container";
import type { ContentId } from "@/lib/primitive-values";
import { cn } from "@/lib/utils";
import { type ContentScriptContext, createShadowRootUi } from "#imports";

import css from "../../assets/tailwindcss-for-isolated-ui.css?inline";
import { ContentIdContext } from "../../hooks/content-id-context";
import { Inspector } from "./in-page-app/inspector";
import { Toasts } from "./in-page-app/toasts";

// eslint-disable-next-line react-refresh/only-export-components -- Keeping root component in the same file because HMR is not supported by WXT
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
    css,

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
