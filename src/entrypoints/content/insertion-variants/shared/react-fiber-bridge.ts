/**
 * Bridge to read React component props from host page DOM nodes.
 * Content scripts run in an isolated world and cannot see React's
 * __reactFiber$ on elements. This module injects a main-world script
 * that does the actual fiber read and communicates results back via
 * data attributes on the element.
 */
import type { Logger } from "@logtape/logtape";
import { nanoid } from "nanoid";

import type { ReactProp } from "@/shared/@model/insertion-configs/shared/primitives";
import { injectScript } from "#imports";

let bridgeScriptPromise: Promise<HTMLScriptElement> | undefined;

function ensureBridge(): Promise<HTMLScriptElement> {
  bridgeScriptPromise ??= injectScript("/react-fiber-bridge-main-world.js", {
    keepInDom: true,
  }).then((result) => result.script);

  return bridgeScriptPromise;
}

/**
 * Resolves a ReactProp value from a DOM element by communicating
 * with the main-world bridge script.
 *
 * The main-world script writes the resolved string directly into a data
 * attribute on the element. Absence of the attribute means "not found".
 *
 * @returns The prop value as a string, or undefined if not found.
 */
export async function resolveReactPropValue({
  element,
  instanceLogger,
  reactProp,
}: {
  element: HTMLElement;
  instanceLogger: Logger;
  reactProp: ReactProp;
}): Promise<string | undefined> {
  const script = await ensureBridge();
  const requestId = nanoid();

  element.dataset["bnReactPropRequest"] = requestId;

  script.dispatchEvent(
    new CustomEvent("bn-resolve-react-prop", {
      detail: { requestId, reactProp },
    }),
  );

  const result = element.dataset["bnReactPropResult"];
  delete element.dataset["bnReactPropResult"];

  if (!result) {
    instanceLogger.debug("No result from fiber bridge for {reactProp}", {
      reactProp,
    });
  }

  return result;
}
