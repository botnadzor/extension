import { produce } from "immer";
import { EyeIcon, EyeOffIcon, InfoIcon, LoaderCircleIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { ButtonWithLoadingState } from "@/components/ui/button-with-loading-state";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useFrontendBaseUrl } from "@/hooks/frontend-service";
import {
  useAuthCheck,
  useAuthStatus,
  useUserConfig,
} from "@/hooks/user-service";
import { formatTime } from "@/lib/formatting";
import { userService } from "@/lib/proxy-services";
import { cn } from "@/lib/utils";
import type { AuthCheck, AuthStatus } from "@/services/user-service";

function UnauthorizedForm({
  authStatus,
  authCheck,
}: {
  authStatus: AuthStatus & { state: "invalid" | "empty" };
  authCheck: AuthCheck;
}) {
  const frontendBaseUrl = useFrontendBaseUrl();
  const [unsavedAccessCode, setUnsavedAccessCode] = React.useState(
    authStatus.accessCode,
  );
  const [accessCodeShown, setAccessCodeShown] = React.useState(false);

  const [lastSavedAccessCode, setLastSavedAccessCode] = React.useState(
    authStatus.accessCode,
  );
  if (lastSavedAccessCode !== authStatus.accessCode) {
    setLastSavedAccessCode(authStatus.accessCode);
    setUnsavedAccessCode(authStatus.accessCode);
  }

  function handleAccessCodeFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const accessCode = formData.get("accessCode");
    if (typeof accessCode !== "string") {
      return;
    }
    void userService.setAccessCode(accessCode);
  }

  return (
    <div className="pt-2.5 pr-3 pb-3 pl-1">
      <form
        onSubmit={handleAccessCodeFormSubmit}
        className="flex items-center gap-2"
        autoComplete="off"
      >
        <div className="relative flex flex-1 items-center gap-2">
          <input
            placeholder="Код доступа"
            name="accessCode"
            value={unsavedAccessCode}
            disabled={authCheck.state === "ongoing"}
            onChange={(e) => {
              setUnsavedAccessCode(e.target.value);
            }}
            className={cn(
              `
                flex h-9 w-full rounded-md border border-input bg-transparent
                py-2 pr-9 pl-2 text-sm u-ring
                placeholder:text-muted-foreground/50
                disabled:text-muted-foreground/50
              `,
              // Imitates type="password" but prevents browsers and password-managers from auto-saving
              !accessCodeShown &&
                `
                  [-moz-text-security:disc] [-webkit-text-security:disc]
                  [text-security:disc]
                `,
            )}
          />

          <button
            className="
              absolute top-1.5 right-1.5 size-6 rounded-xs p-1 whitespace-nowrap
              text-muted-foreground u-ring
              hover:text-foreground
              [&>svg]:size-4
            "
            onClick={() => {
              setAccessCodeShown(!accessCodeShown);
            }}
            type="button"
          >
            {accessCodeShown ? <EyeIcon /> : <EyeOffIcon />}
          </button>
        </div>

        <ButtonWithLoadingState
          disabled={unsavedAccessCode.length === 0}
          loading={authCheck.state === "ongoing"}
        >
          Установить
        </ButtonWithLoadingState>
      </form>

      <div className="mt-3 h-lh truncate text-sm text-destructive">
        {authStatus.state === "invalid" &&
          authCheck.state === "idle" &&
          unsavedAccessCode === authStatus.accessCode &&
          "Код доступа вставлен с ошибкой или просрочен"}
      </div>

      <div className="pt-2 text-xs">
        Код доступа вы можете получить через{" "}
        <a
          target="_blank"
          href="https://t.me/botnadzor_org_bot"
          rel="noreferrer noopener"
          className="u-link"
        >
          нашего бота в&nbsp;Telegram
        </a>
        . Дополнительные уровни доступа можно получить за{" "}
        <a
          target="_blank"
          href={`${frontendBaseUrl}/docs/how-to-help#cards`}
          rel="noreferrer noopener"
          className="u-link"
        >
          отправку карточек ботов
        </a>{" "}
        при подписке на&nbsp;регулярную поддержку проекта.
      </div>
    </div>
  );
}

function AuthorizedForm({
  authStatus,
  authCheck,
}: {
  authStatus: AuthStatus & { state: "valid" };
  authCheck: AuthCheck;
}) {
  const userConfig = useUserConfig();
  const frontendBaseUrl = useFrontendBaseUrl();

  function handleCollectingCommentsChange() {
    void userService.setConfig(
      produce(userConfig, (draft) => {
        if (draft.collectingComments === undefined) {
          draft.collectingComments = true;
        } else {
          delete draft.collectingComments;
        }
      }),
    );
  }

  return (
    <div className="p-3 pt-2.5 pl-1">
      <div
        className={cn(
          "space-y-1 text-sm transition-opacity",
          authCheck.state === "ongoing" && "opacity-50 duration-300",
        )}
      >
        <p>Код доступа установлен</p>
        {authStatus.expiresAt && (
          <p>Код работает до {formatTime(authStatus.expiresAt)}</p>
        )}
        <p>Уровень доступа: {authStatus.accessLevel}</p>
        <p>Очки: {authStatus.pointCount.toLocaleString("ru-RU")}</p>
      </div>
      <div className="pt-6 text-xs">
        Вы можете зарабатывать очки, <br />
        <a
          href={`${frontendBaseUrl}/docs/how-to-help#cards`}
          target="_blank"
          rel="noopener noreferrer"
          className="u-link whitespace-nowrap"
        >
          помечая ботов карточками
        </a>
      </div>
      <div className="flex max-w-50 flex-col gap-2 pt-6">
        <ButtonWithLoadingState
          disabled={authCheck.state === "ongoing"}
          loading={authCheck.state === "ongoing"}
          onClick={() => {
            void userService.checkAuth();
          }}
        >
          Обновить информацию
        </ButtonWithLoadingState>
        <Button
          disabled={authCheck.state === "ongoing"}
          onClick={() => {
            void userService.setAccessCode("");
          }}
        >
          Сбросить код доступа
        </Button>
      </div>
      <Label className="pt-6">
        <Checkbox
          checked={userConfig.collectingComments ?? false}
          onClick={handleCollectingCommentsChange}
        />
        Сбор и отправка комментаторов
        <a
          href={`${frontendBaseUrl}/docs/extension#replies-collecting`}
          target="_blank"
          rel="noopener noreferrer"
          className="u-link rounded-full"
        >
          <InfoIcon className="size-4" />
        </a>
      </Label>
    </div>
  );
}

function UnknownStateForm({ authCheck }: { authCheck: AuthCheck }) {
  if (authCheck.state === "ongoing") {
    return (
      <div className="pt-2.5 pl-1">
        <LoaderCircleIcon className="inline-block size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="pt-2.5 pr-3 pl-1">
      <p className="pb-4 text-sm">
        Не удалось проверить ваш код доступа. Попробуйте ещё раз с включённым
        или отключённым VPN.
      </p>

      <div className="flex max-w-50 flex-col gap-2">
        <Button
          onClick={() => {
            void userService.checkAuth();
          }}
        >
          Проверить код доступа
        </Button>
        <Button
          onClick={() => {
            void userService.setAccessCode("");
          }}
        >
          Сбросить код доступа
        </Button>
      </div>
    </div>
  );
}

export function AccessTabBody() {
  const authStatus = useAuthStatus();
  const authCheck = useAuthCheck();

  if (authStatus.state === "valid") {
    return <AuthorizedForm authStatus={authStatus} authCheck={authCheck} />;
  }

  if (authStatus.state === "unknown") {
    return <UnknownStateForm authCheck={authCheck} />;
  }

  return <UnauthorizedForm authStatus={authStatus} authCheck={authCheck} />;
}
