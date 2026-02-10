import * as React from "react";

import type {
  ExtensionVersionDeprecation,
  ExtensionVersionInfo,
} from "@/shared/@model/extension-version";
import { useFrontendBaseUrl } from "@/shared/@ui-helpers/data-hooks";
import { createMessage } from "@/shared/formatting";
import { generateUrl } from "@/shared/url-helpers";

import { Toast } from "./toast";

const agedMessage = createMessage(
  "Версия {versionName} создана {ageInDays} {ageInDays, plural, one {день} few {дня} other {дней}} назад.",
);

const noLongerSupportedByApiMessage = createMessage(
  "Версия {versionName} больше не поддерживается.",
);

export function ToastWithDeprecatedExtensionVersion({
  deprecation,
  versionName,
}: ExtensionVersionInfo & { deprecation: ExtensionVersionDeprecation }) {
  const frontendBaseUrl = useFrontendBaseUrl();

  const [acknowledged, setAcknowledged] = React.useState(false);

  if (acknowledged) {
    return;
  }

  let message: React.ReactNode;
  switch (deprecation.reason) {
    case "aged": {
      message = agedMessage.format({
        ageInDays: deprecation.ageInDays,
        versionName,
      });
      break;
    }
    case "noLongerSupportedByApi": {
      message = noLongerSupportedByApiMessage.format({
        versionName,
      });
      break;
    }
  }

  return (
    <Toast
      onClose={() => {
        setAcknowledged(true);
      }}
    >
      {message} Пожалуйста, обновите расширение{" "}
      <a href={generateUrl(frontendBaseUrl, "/docs/extension")}>
        при помощи нашей инструкции
      </a>{" "}
      или{" "}
      <a href="https://github.com/botnadzor/extension/releases">
        из&nbsp;Гитхаба
      </a>
      .
    </Toast>
  );
}
