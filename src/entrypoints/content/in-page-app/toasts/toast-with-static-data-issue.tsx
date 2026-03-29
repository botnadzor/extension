import * as React from "react";

import { ExtensionPopupLink } from "./shared/extension-popup-link";
import { Toast } from "./toast";

export function ToastWithStaticDataIssue() {
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) {
    return;
  }

  return (
    <Toast
      onClose={() => {
        setDismissed(true);
      }}
    >
      Не удалось загрузить данные: браузер выделил меньше места, чем ожидалось.
      Подробнее —{" "}
      <ExtensionPopupLink
        onClick={() => {
          setDismissed(true);
        }}
      />
      .
    </Toast>
  );
}
