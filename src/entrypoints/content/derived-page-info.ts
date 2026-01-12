import { type ContentScriptHost, contentScriptHosts } from "./hosts";

export type WebsiteVariant = "mobileVkWebsite" | "desktopVkWebsite";

function getMatchedHost(location: Location): ContentScriptHost | undefined {
  const directMatch = contentScriptHosts.find((host) => location.host === host);

  if (directMatch) {
    return directMatch;
  }

  if (location.host !== "web.archive.org") {
    return undefined;
  }

  for (const host of contentScriptHosts) {
    if (
      new RegExp(String.raw`^/web/\d+/https://${host}/`).test(location.pathname)
    ) {
      return host;
    }
  }

  return undefined;
}

export type DerivedPageInfo = {
  archivedSnapshot: boolean;
  websiteVariant: WebsiteVariant;
};

export function derivePageInfo(
  location: Location,
): DerivedPageInfo | undefined {
  const matchedHost = getMatchedHost(location);

  if (!matchedHost) {
    return;
  }

  return {
    archivedSnapshot: location.host === "web.archive.org",
    websiteVariant: matchedHost.startsWith("m.")
      ? "mobileVkWebsite"
      : "desktopVkWebsite",
  };
}
