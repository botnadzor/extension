export function getRadixPortalContainerElement(): HTMLElement | undefined {
  return (
    document
      .querySelector<HTMLElement>("botnadzor-in-page-app")
      ?.shadowRoot?.querySelector<HTMLElement>("#radix-portal-container") ??
    undefined
  );
}

export function RadixPortalContainer() {
  return <div className="static" id="radix-portal-container" />;
}
