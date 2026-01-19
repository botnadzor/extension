import type { z } from "zod/mini";

import { getBackgroundLogger } from "@/shared/logging";

import type { accessErrorKindSchema } from "./=access";
import type { inspectorErrorKindSchema } from "./=inspector";
import type { regDateErrorKindSchema } from "./=reg-date";
import type { reportErrorKindSchema } from "./=report";

const logger = getBackgroundLogger(["dynamic-api-endpoints"]);

type DerivedErrorKindFromLegacyError =
  | z.infer<typeof accessErrorKindSchema>
  | z.infer<typeof inspectorErrorKindSchema>
  | z.infer<typeof regDateErrorKindSchema>
  | z.infer<typeof reportErrorKindSchema>;

function deriveErrorKindFromLegacyError(
  legacyErrorMessage: string | null,
): DerivedErrorKindFromLegacyError {
  if (
    legacyErrorMessage === "Код доступа не найден" ||
    legacyErrorMessage === "Ошибка кода доступа" ||
    legacyErrorMessage === "Код доступа просрочен" ||
    legacyErrorMessage === "Мы заметили подозрительную активность"
  ) {
    return "unauthorized";
  }

  if (legacyErrorMessage === "Аккаунт с таким никнеймом не найден") {
    return "notFound";
  }

  if (legacyErrorMessage === "Пользователь уже был проверен недавно") {
    return "recentlyChecked";
  }

  if (legacyErrorMessage === "Аккаунт уже является подтверждённым ботом") {
    return "alreadyConfirmed";
  }

  if (legacyErrorMessage?.startsWith("На проверку можно отправить не более")) {
    return "methodQuotaExceeded";
  }

  if (legacyErrorMessage === "Тип маркировки не передан") {
    return "invalidTagSuggestion";
  }

  if (
    legacyErrorMessage ===
    "Текст комментария не передан или больше 200 символов"
  ) {
    return "invalidText";
  }

  if (
    legacyErrorMessage === "Ссылка на комментарий не передана" ||
    // cspell:ignore айди
    legacyErrorMessage === "Айди аккаунта не передан"
  ) {
    return "invalidPayload";
  }

  if (
    legacyErrorMessage === "Нет доступа к команде" ||
    legacyErrorMessage?.startsWith(
      "Не хватает очков для отправки аккаунта на проверку",
    )
  ) {
    return "missingPermission";
  }

  logger.error(
    "Unexpected error while deriving error kind from legacy error: {error}",
    { error: legacyErrorMessage },
  );

  return "unexpectedError";
}

export function normalizeLegacyError<
  ErrorKindSchema extends z.ZodMiniType<string>,
>(
  legacyErrorMessage: string,
  errorKindSchema: ErrorKindSchema,
): {
  errorKind: z.infer<typeof errorKindSchema> | "unexpectedError";
  errorMessage: string;
} {
  const errorKind = deriveErrorKindFromLegacyError(legacyErrorMessage);
  const errorKindResult = errorKindSchema.safeParse(errorKind);

  return {
    errorKind: errorKindResult.success
      ? errorKindResult.data
      : "unexpectedError",
    errorMessage: legacyErrorMessage,
  };
}
