import { z } from "zod/mini";

import { browser, defineAppConfig } from "#imports";

const manifest = browser.runtime.getManifest();

declare module "wxt/utils/define-app-config" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- extending existing interface
  export interface WxtAppConfig {
    /**
     * Whether to enable DX overlays and sidepanel features.
     * DX features are excluded from production builds by default.
     */
    dxFeaturesEnabled: boolean;

    /**
     * Whether to persist the content id across page reloads. If content id
     * is persistent, inspector and previously triggered toasts will be restored
     * after page reload.
     */
    persistentContentIdEnabled: boolean;

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
  dxFeaturesEnabled: z
    .stringbool()
    .parse(import.meta.env["WXT_DX_FEATURES_ENABLED"]),

  persistentContentIdEnabled: z
    .stringbool()
    .parse(import.meta.env["WXT_PERSISTENT_CONTENT_ID_ENABLED"]),

  syncStorageAllowed,
});
