import {
  type ArchivedContentScriptHost,
  archivedContentScriptHosts,
  contentScriptHosts,
} from "./hosts-and-matches";

export type WebsiteVariant = "mobileVkWebsite" | "desktopVkWebsite";

function getMatchedHost(
  location: Pick<Location, "host" | "pathname">,
): ArchivedContentScriptHost | undefined {
  const directMatch = contentScriptHosts.find((host) => location.host === host);

  if (directMatch) {
    return directMatch;
  }

  if (location.host !== "web.archive.org") {
    return undefined;
  }

  for (const host of archivedContentScriptHosts) {
    const escapedHost = host.replaceAll(".", String.raw`\.`);
    if (
      new RegExp(
        String.raw`^/web/\d+(?:[a-z]{2}_)?/https?://${escapedHost}/`,
      ).test(location.pathname)
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
  location: Pick<Location, "host" | "pathname">,
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
