import type { PopupTab } from "@/shared/@model/popup";
import { popupService } from "@/shared/proxy-services";

// Unable to call action "openPopup" in Firefox. When sending message to background, getting
// `Uncaught (in promise) Error: openPopup requires a user gesture`
// Context: https://bugzilla.mozilla.org/show_bug.cgi?id=1799344#c4
// TODO: Review this in future versions of Firefox when the above issue is fixed
const popupCanBeOpened = !import.meta.env.FIREFOX;

export function ExtensionPopupLink({
  children = "в меню расширения",
  tab,
  onClick,
}: {
  children?: React.ReactNode | undefined;
  onClick?: () => void;
  tab?: PopupTab;
}) {
  function handleToggleMenuClick(event: React.MouseEvent) {
    event.preventDefault();

    void popupService.open(tab ? { tab } : {});

    setTimeout(() => {
      onClick?.();
    }, 1000);
  }

  return popupCanBeOpened ? (
    <a href="#botnadzor-extension-popup" onClick={handleToggleMenuClick}>
      {children}
    </a>
  ) : (
    <>{children}</>
  );
}
