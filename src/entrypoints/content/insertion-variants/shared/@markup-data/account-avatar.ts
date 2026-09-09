import type { ImageUrlSelector } from "@/shared/@model/insertion-configs/shared/primitives";

import { resolveImageUrlSelector } from "../selector-resolution";

export function extractAccountAvatarUrlFromMarkup(
  rootElement: HTMLElement,
  accountAvatarSelector: ImageUrlSelector,
): string {
  return (
    resolveImageUrlSelector(rootElement, accountAvatarSelector) ??
    "https://vk.ru/images/camera_200.png"
  );
}
