import * as React from "react";

import { useStaticListsDataIssueState } from "@/shared/@ui-helpers/data-hooks";
import { Button } from "@/shared/@ui-primitives/button";
import { staticListsService } from "@/shared/proxy-services";

export function StaticDataIssueBanner() {
  const dataIssueState = useStaticListsDataIssueState();
  const [deleteCacheConfirmationShown, setDeleteCacheConfirmationShown] =
    React.useState(false);
  const deleteCacheConfirmationVisible =
    deleteCacheConfirmationShown &&
    dataIssueState.kind === "updatesBlockedButExistingDataUsable";

  if (dataIssueState.kind === "none") {
    return;
  }

  return (
    <div
      className="
        border-y border-amber-500/20 bg-amber-500/10 px-3 pt-2.5 pb-4 text-sm
        text-foreground
        dark:border-amber-300/20 dark:bg-amber-300/10
      "
    >
      <div className="space-y-2">
        <p>
          {dataIssueState.kind === "initialDataUnavailable" ? (
            <>
              Не удалось загрузить данные: браузер выделил меньше места, чем
              ожидалось. Для быстрой подсветки ботов расширению нужно хранить
              порядка 50 мегабайт на вашем устройстве.
            </>
          ) : (
            <>
              Не удалось обновить данные: браузер выделил меньше места, чем
              ожидалось. Для быстрой подсветки ботов расширению нужно хранить
              порядка 50 мегабайт на вашем устройстве. Во время обновления
              данных потребление диска ненадолго возрастает.
            </>
          )}
        </p>

        {deleteCacheConfirmationVisible ? (
          <div className="space-y-2">
            <p className="text-destructive">
              Очистить временно сохранённые данные и попробовать снова?
              Подсветка ботов отключится на время обновления.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDeleteCacheConfirmationShown(false);
                }}
              >
                Отмена
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  void staticListsService.retryBlockedRemoteUpdates({
                    deleteActiveCache: true,
                  });
                }}
              >
                Очистить кэш и повторить
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                void staticListsService.retryBlockedRemoteUpdates();
              }}
            >
              Повторить попытку
            </Button>
            {dataIssueState.kind === "updatesBlockedButExistingDataUsable" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDeleteCacheConfirmationShown(true);
                }}
              >
                Очистить кэш и повторить
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
