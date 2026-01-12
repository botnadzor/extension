import calendarDays from "lucide-static/icons/calendar-days.svg?raw";
import squareMenu from "lucide-static/icons/square-menu.svg?raw";
import squareUser from "lucide-static/icons/square-user.svg?raw";
import userPlus from "lucide-static/icons/user-plus.svg?raw";
import userSearch from "lucide-static/icons/user-search.svg?raw";

const iconLookup = {
  calendarDays,
  squareMenu,
  squareUser,
  userPlus,
  userSearch,
} satisfies Record<string, string>;

export type IconId = keyof typeof iconLookup;

export function createIconElement({
  iconId,
  className,
}: {
  iconId: IconId;
  className?: string | undefined;
}): SVGElement {
  const tmpElement = document.createElement("div");
  // eslint-disable-next-line no-unsanitized/property -- icon HTML is trusted because it originates from a static import
  tmpElement.innerHTML = iconLookup[iconId];
  const svg = tmpElement.querySelector("svg");

  if (!(svg instanceof SVGElement)) {
    // eslint-disable-next-line no-restricted-syntax -- if this happens, it's an implementation defect rather than a runtime exception
    throw new TypeError(`Icon ${iconId} is not an SVG element`);
  }

  if (className) {
    svg.setAttribute("class", className);
  }

  return svg;
}
