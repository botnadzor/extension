export function getPortalContainerElement(): HTMLElement | undefined {
  return (
    document
      .querySelector<HTMLElement>("botnadzor-in-page-app")
      ?.shadowRoot?.querySelector<HTMLElement>("#portal-container") ?? undefined
  );
}

export function PortalContainer() {
  return <div className="static" id="portal-container" />;
}
