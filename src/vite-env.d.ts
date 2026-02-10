import type { BaseExtensionVersionInfo } from "./shared/@model/extension-version";

declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- expected use of __SCREAMING_CASE__ to match vite convention https://vite.dev/config/shared-options#define
  const __BASE_EXTENSION_VERSION_INFO__: BaseExtensionVersionInfo;
}
