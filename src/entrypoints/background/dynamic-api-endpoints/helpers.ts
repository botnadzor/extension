import { getBackgroundLogger } from "@/lib/logging";

const logger = getBackgroundLogger(["dynamic-api-endpoints"]);

export function convertLegacyErrorToDynamicApiError(error: string | null): {
  success: false;
  reason: "notFound" | "tooManyRequests" | "unauthorized" | "unexpectedError";
} {
  if (error === "Мы заметили подозрительную активность") {
    return { success: false, reason: "tooManyRequests" };
  }

  if (
    error === "Код доступа не найден" ||
    error === "Ошибка кода доступа" ||
    error === "Код доступа просрочен"
  ) {
    return { success: false, reason: "unauthorized" };
  }

  if (error === "Аккаунт с таким никнеймом не найден" || error === null) {
    return { success: false, reason: "notFound" };
  }

  logger.error(
    "Unexpected error while converting legacy error to dynamic API error: {error}",
    { error },
  );

  return { success: false, reason: "unexpectedError" };
}
