function canScrollElement(element: HTMLElement): boolean {
  const computedStyle = getComputedStyle(element);
  const overflowY = computedStyle.overflowY;

  return (
    (overflowY === "auto" ||
      overflowY === "overlay" ||
      overflowY === "scroll") &&
    element.scrollHeight > element.clientHeight
  );
}

export function findScrollableInsideAccountListElement(
  accountListElement: HTMLElement,
): HTMLElement {
  if (canScrollElement(accountListElement)) {
    return accountListElement;
  }

  for (const descendant of accountListElement.querySelectorAll("*")) {
    if (!(descendant instanceof HTMLElement)) {
      continue;
    }

    if (canScrollElement(descendant)) {
      return descendant;
    }
  }

  return accountListElement;
}

export function scrollAccountListToEnd(accountListElement: HTMLElement): void {
  const scrollableElement =
    findScrollableInsideAccountListElement(accountListElement);

  scrollableElement.scrollTo({
    top: scrollableElement.scrollHeight,
  });
}
