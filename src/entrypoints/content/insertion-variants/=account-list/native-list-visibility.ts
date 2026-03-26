const tableModeStyleLookup = {
  opacity: "0",
  pointerEvents: "none",
} as const;

type StyleProperty = keyof typeof tableModeStyleLookup;
const hiddenStyleEntries: Array<[StyleProperty, string]> = [
  ["opacity", tableModeStyleLookup.opacity],
  ["pointerEvents", tableModeStyleLookup.pointerEvents],
];
const hiddenStyleProperties = hiddenStyleEntries.map(([property]) => property);

export function createNativeListTableModeController(element: HTMLElement): {
  disable: () => void;
  enable: () => void;
} {
  const originalStyleLookup = new Map<StyleProperty, string>();
  let enabled = false;

  function enable() {
    if (enabled) {
      return;
    }

    for (const [property, value] of hiddenStyleEntries) {
      originalStyleLookup.set(property, element.style[property]);
      element.style[property] = value;
    }

    enabled = true;
  }

  function disable() {
    if (!enabled) {
      return;
    }

    for (const property of hiddenStyleProperties) {
      const originalValue = originalStyleLookup.get(property);
      element.style[property] = originalValue ?? "";
    }

    enabled = false;
  }

  return {
    disable,
    enable,
  };
}
