import * as React from "react";

import type { ContentId } from "@/shared/@primitives/misc";

export const ContentIdContext = React.createContext<ContentId | undefined>(
  undefined,
);

export function useContentId(): ContentId {
  const value = React.use(ContentIdContext);
  if (!value) {
    // eslint-disable-next-line no-restricted-syntax -- if this happens, it's an implementation defect rather than a runtime exception
    throw new Error(
      "Calling useContentId() without ContentIdContext around it",
    );
  }
  return value;
}
