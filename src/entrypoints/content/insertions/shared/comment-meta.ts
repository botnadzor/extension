export function extractCommenterNameBySelector(
  root: HTMLElement,
  selector: string,
): string | undefined {
  const element = root.querySelector(selector);
  if (!(element instanceof HTMLElement)) {
    return;
  }

  const raw = element.textContent;
  if (!raw) {
    return;
  }

  const text = raw.trim();
  if (text.length === 0) {
    return;
  }

  return text;
}

export function extractCommenterAvatarUrlBySelector(
  root: HTMLElement,
  selectors: string[],
): string | undefined {
  for (const selector of selectors) {
    const image = root.querySelector(selector);
    if (!(image instanceof HTMLImageElement)) {
      return;
    }

    const src = image.getAttribute("src");
    if (!src) {
      return;
    }

    const trimmed = src.trim();
    if (trimmed.length === 0) {
      return;
    }

    return trimmed;
  }

  return;
}

export function extractPostCommentCountFromDataset(
  root: HTMLElement,
  options: {
    postRootSelector: string;
    commentButtonSelector: string;
    datasetKey: string;
  },
): number | undefined {
  const { postRootSelector, commentButtonSelector, datasetKey } = options;

  const postRoot = root.closest<HTMLElement>(postRootSelector);
  if (!postRoot) {
    return;
  }

  const commentsButton = postRoot.querySelector<HTMLElement>(
    commentButtonSelector,
  );
  if (!commentsButton) {
    return;
  }

  const attr = commentsButton.dataset[datasetKey];
  if (!attr) {
    return;
  }

  const trimmed = attr.trim();
  if (trimmed.length === 0) {
    return;
  }

  const digitsOnly = trimmed.replaceAll(/\D+/g, "");
  if (digitsOnly.length === 0) {
    return;
  }

  const value = Number(digitsOnly);
  if (!Number.isFinite(value)) {
    return;
  }

  return value;
}

export function extractPostCommentCountFromAriaLabel(
  root: HTMLElement,
  options: {
    postRootSelector: string;
    commentButtonSelector: string;
    ariaAttributeName?: string;
  },
): number | undefined {
  const {
    postRootSelector,
    commentButtonSelector,
    ariaAttributeName = "aria-label",
  } = options;

  const postRoot = root.closest<HTMLElement>(postRootSelector);
  if (!postRoot) {
    return;
  }

  const commentsButton = postRoot.querySelector<HTMLElement>(
    commentButtonSelector,
  );
  if (!commentsButton) {
    return;
  }

  const aria = commentsButton.getAttribute(ariaAttributeName);
  if (!aria) {
    return;
  }

  const trimmed = aria.trim();
  if (trimmed.length === 0) {
    return;
  }

  const digitsOnly = trimmed.replaceAll(/\D+/g, "");
  if (digitsOnly.length === 0) {
    return;
  }

  const value = Number(digitsOnly);
  if (!Number.isFinite(value)) {
    return;
  }

  return value;
}
