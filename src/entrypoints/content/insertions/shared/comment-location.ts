import {
  positiveVkIdSchema,
  type VkDomain,
  vkDomainSchema,
  vkIdSchema,
} from "@/shared/@model/primitives";

import type { CommentLocation } from "./types";

export function extractVkDomainFromHref(href: string): VkDomain | undefined {
  let match = /^(?:https?:\/\/[^/]+)?\/video\/@?([^/?#]+)/.exec(href);
  if (match?.[1]) {
    const domain = vkDomainSchema.safeParse(match[1]).data;
    if (domain) {
      return domain;
    }
  }

  match = /^(?:https?:\/\/[^/]+)?\/([^/?#]+)/.exec(href);
  if (match?.[1]) {
    return vkDomainSchema.safeParse(match[1]).data;
  }

  return;
}

export function extractVkDomainFromAuthorLink(
  authorLink: HTMLAnchorElement,
): VkDomain | undefined {
  const href = authorLink.getAttribute("href");
  if (!href) {
    return;
  }

  return extractVkDomainFromHref(href);
}

export function extractCommentLocationFromHref(
  href: string,
): CommentLocation | undefined {
  const wallRegexp = /(?:https?:\/\/vk\.com)?\/(photo|video|wall)(-?\d+)_(\d+)/;
  const wallMatch = wallRegexp.exec(href);
  if (!wallMatch) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- type assertion corresponds to the regexp
  const postType = wallMatch[1] as "photo" | "video" | "wall";
  const wallNumber = Number(wallMatch[2]);
  const postNumber = Number(wallMatch[3]);

  if (!Number.isFinite(wallNumber) || !Number.isFinite(postNumber)) {
    return;
  }

  const wallVkId = vkIdSchema.parse(wallNumber);
  const postVkId = positiveVkIdSchema.parse(postNumber);

  const replyMatch = /[?&]reply=(\d+)/.exec(href);
  const commentNumber = replyMatch ? Number(replyMatch[1]) : postNumber;

  if (!Number.isFinite(commentNumber)) {
    return;
  }

  const commentVkId = positiveVkIdSchema.parse(commentNumber);

  return { postType, wallVkId, postVkId, commentVkId };
}

export function extractCommentLocationFromReplyClick(
  onclick: string,
): CommentLocation | undefined {
  const wallLike = /replyClick\('wall(-?\d+)_(\d+)'\s*,\s*(\d+)/.exec(onclick);
  if (wallLike) {
    const ownerNumber = Number(wallLike[1]);
    const postNumber = Number(wallLike[2]);
    const commentNumber = Number(wallLike[3]);

    if (
      !Number.isFinite(ownerNumber) ||
      !Number.isFinite(postNumber) ||
      !Number.isFinite(commentNumber)
    ) {
      return;
    }

    return {
      postType: "wall",
      wallVkId: vkIdSchema.parse(ownerNumber),
      postVkId: positiveVkIdSchema.parse(postNumber),
      commentVkId: positiveVkIdSchema.parse(commentNumber),
    };
  }

  const photoLike = /replyClick\('(-?\d+)_photo(\d+)'\s*,\s*(\d+)/.exec(
    onclick,
  );
  if (photoLike) {
    const ownerNumber = Number(photoLike[1]);
    const photoNumber = Number(photoLike[2]);
    const commentNumber = Number(photoLike[3]);

    if (
      !Number.isFinite(ownerNumber) ||
      !Number.isFinite(photoNumber) ||
      !Number.isFinite(commentNumber)
    ) {
      return;
    }

    return {
      postType: "photo",
      wallVkId: vkIdSchema.parse(ownerNumber),
      postVkId: positiveVkIdSchema.parse(photoNumber),
      commentVkId: positiveVkIdSchema.parse(commentNumber),
    };
  }

  const plainLike = /replyClick\('(-?\d+)_(\d+)'\s*,\s*(\d+)/.exec(onclick);
  if (plainLike) {
    const ownerNumber = Number(plainLike[1]);
    const postNumber = Number(plainLike[2]);
    const commentNumber = Number(plainLike[3]);

    if (
      !Number.isFinite(ownerNumber) ||
      !Number.isFinite(postNumber) ||
      !Number.isFinite(commentNumber)
    ) {
      return;
    }

    return {
      postType: "wall",
      wallVkId: vkIdSchema.parse(ownerNumber),
      postVkId: positiveVkIdSchema.parse(postNumber),
      commentVkId: positiveVkIdSchema.parse(commentNumber),
    };
  }

  return;
}
