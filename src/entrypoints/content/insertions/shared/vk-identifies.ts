import { type VkDomain, vkDomainSchema } from "@/shared/@model/primitives";

export function extractVkDomainFromHref(
  href: string | null,
): VkDomain | undefined {
  if (!href) {
    return;
  }

  if (
    href.startsWith("/away.php") ||
    href.startsWith("https://vk.com/away.php")
  ) {
    return;
  }

  const match = /^\/([^/?#]+)/.exec(href);

  return vkDomainSchema.safeParse(match?.[1]).data;
}

export function getVkDomainFromRow(row: HTMLElement): VkDomain | undefined {
  const link = row.querySelector("a[href^='/']");
  if (!(link instanceof HTMLAnchorElement)) {
    return;
  }

  return extractVkDomainFromHref(link.getAttribute("href"));
}

export function extractVkDomainFromReplyInputValue(
  replyTargetInput: HTMLInputElement,
): VkDomain | undefined {
  const commentId = replyTargetInput.value.trim();
  if (!commentId) {
    return;
  }

  const root = document.querySelector(`[id$="_${commentId}"]`);
  if (!(root instanceof HTMLElement)) {
    return;
  }

  const replyRoot = root.closest(".reply");
  if (!(replyRoot instanceof HTMLElement)) {
    return;
  }

  const authorLink = replyRoot.querySelector(".reply_author a.author");
  if (!(authorLink instanceof HTMLAnchorElement)) {
    return;
  }

  return extractVkDomainFromHref(authorLink.getAttribute("href"));
}
