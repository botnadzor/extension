import { customAlphabet } from "nanoid";

import type { VkDomain } from "./@primitives/vk";

export type SearchParamsAsObject = Readonly<
  Record<string, string | string[] | number | undefined>
>;

function cleanupSearchParams(
  searchParamsAsObject: SearchParamsAsObject,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(searchParamsAsObject)
      .filter(
        (pair): pair is [string, string | string[] | number] =>
          pair[1] !== undefined,
      )
      .map(([key, value]) => [
        key,
        typeof value === "number"
          ? value.toString()
          : typeof value === "string"
            ? value
            : value.join(","),
      ]),
  );
}

export function stringifySearchParams(
  searchParams: SearchParamsAsObject,
): string {
  return new URLSearchParams(cleanupSearchParams(searchParams)).toString();
}

export function generateHref(
  pathname: string,
  searchParams: SearchParamsAsObject | URLSearchParams,
  hash?: string,
): string {
  const hashWithoutPrefix = hash?.startsWith("#") ? hash.slice(1) : hash;

  const stringifiedSearchParams =
    searchParams instanceof URLSearchParams
      ? searchParams.toString()
      : stringifySearchParams(searchParams);
  return `${pathname}${
    stringifiedSearchParams || !pathname ? `?${stringifiedSearchParams}` : ""
  }${hashWithoutPrefix ? `#${hashWithoutPrefix}` : ""}`;
}

export function generateUrl(
  baseUrl: string,
  pathname: string,
  searchParams?: SearchParamsAsObject | URLSearchParams,
  hash?: string,
): string {
  return `${baseUrl}${generateHref(pathname, searchParams ?? {}, hash)}`;
}

export const defaultVkBaseUrl = "https://vk.com";

export function detectVkBaseUrl(url: string): string {
  const [officialMatch] = /^https:\/\/(?:m\.)?vk\.(com|ru)/.exec(url) ?? [];

  if (officialMatch) {
    return officialMatch;
  }

  const [webArchiveMatch] =
    /^https:\/\/web\.archive\.org\/web\/\d+\/https?:\/\/((?:m\.)?vk\.(com|ru)|vkontakte\.ru)/.exec(
      url,
    ) ?? [];

  if (webArchiveMatch) {
    return webArchiveMatch;
  }

  return defaultVkBaseUrl;
}

const randParamFirstCharacter = customAlphabet("123456789", 1);
const randParamRemainingCharacters = customAlphabet("0123456789", 9);

export function generateCardUrl({
  frontendBaseUrl,
  vkDomain,
}: {
  frontendBaseUrl: string;
  vkDomain: VkDomain;
}): string {
  return generateUrl(frontendBaseUrl, `/card/${vkDomain}`, {
    rand: `${randParamFirstCharacter()}${randParamRemainingCharacters()}`,
  });
}
