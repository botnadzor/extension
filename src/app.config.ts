import { z } from "zod/mini";

import { browser, defineAppConfig } from "#imports";

const manifest = browser.runtime.getManifest();

declare module "wxt/utils/define-app-config" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- extending existing interface
  export interface WxtAppConfig {
    /**
     * If set to true, the extension will show extra tags for accounts that are
     * not in the static lists. This can help with debugging insertions.
     */
    extraTags: boolean;

    /**
     * Whether to persist the content id across page reloads. If content id
     * is persistent, inspector and previously triggered toasts will be restored
     * after page reload.
     */
    persistentContentId: boolean;

    syncStorageAllowed: boolean;
  }
}

const syncStorageAllowed: boolean = (() => {
  if (import.meta.env.BROWSER !== "firefox") {
    return true;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- justified use of any for runtime config
  const id = manifest["browser_specific_settings"]?.gecko?.id;
  return Boolean(id);
})();

export default defineAppConfig({
  extraTags: z.stringbool().parse(import.meta.env["WXT_EXTRA_TAGS"]),

  persistentContentId: z
    .stringbool()
    .parse(import.meta.env["WXT_PERSISTENT_CONTENT_ID"]),

  syncStorageAllowed,
});
