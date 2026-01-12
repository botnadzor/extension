export function extractVkDomain(href: string | null): string | undefined {
  if (!href) {
    return;
  }

  const match = /^\/([^/?#]+)/.exec(href);
  return match?.[1];
}

export function getVkDomainFromRow(row: HTMLElement): string | undefined {
  const link = row.querySelector("a[href^='/']");
  if (!link) {
    return;
  }

  return extractVkDomain(link.getAttribute("href"));
}
