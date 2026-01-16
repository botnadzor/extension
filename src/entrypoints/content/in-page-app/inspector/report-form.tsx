import { delay } from "es-toolkit";
import { SendIcon } from "lucide-react";
import * as React from "react";

import {
  type TagId,
  tagIdSchema,
  type VkDomain,
} from "@/shared/@model/primitives";
import {
  useAccountInspection,
  useStaticListItems,
} from "@/shared/@ui-helpers/data-hooks";
import { ButtonWithLoadingState } from "@/shared/@ui-primitives/button-with-loading-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/@ui-primitives/select";
import { Textarea } from "@/shared/@ui-primitives/textarea";
import { cn } from "@/shared/tailwindcss-helpers";

import { Placeholder } from "./placeholder";

const minLength = 10;
const maxLength = 200;

const emptySelectValue = "-";

type ReportResult =
  | {
      success: true;
      remainingPoints?: number;
      remainingPermissionLookup?: Record<string, true>;
    }
  | {
      success: false;
      errorMessage: string;
    };

export function ReportForm({ vkDomain }: { vkDomain: VkDomain }) {
  const accountInspection = useAccountInspection(vkDomain);
  const tags = useStaticListItems("tags");
  const filteredTags = tags.filter((tag) => /^\d/.exec(tag.id));

  const [tagId, setTagId] = React.useState<TagId | undefined>();
  const [text, setText] = React.useState("");

  const [reportResult, setReportResult] = React.useState<
    ReportResult | undefined
  >();
  const [submitting, setSubmitting] = React.useState(false);

  const reportingMistake =
    accountInspection.success && accountInspection.data.mark;

  async function report() {
    setSubmitting(true);
    await delay(500);

    if (!tagId) {
      setSubmitting(false);
      setReportResult({
        success: false,
        errorMessage: "Выберите подходящую маркировку",
      });
      return;
    }

    if (text.length < minLength) {
      setSubmitting(false);
      setReportResult({
        success: false,
        errorMessage: `Минимальная длина текста: ${minLength} символов`,
      });
      return;
    }

    if (text.length > maxLength) {
      setSubmitting(false);
      setReportResult({
        success: false,
        errorMessage: `Максимальная длина текста: ${maxLength} символов`,
      });
      return;
    }

    await delay(500);

    setSubmitting(false);
    setReportResult({
      success: true,
      remainingPoints: 100,
    });
  }

  if (reportResult?.success === true) {
    return (
      <Placeholder>
        Ваше сообщение отправлено (пока что в тестовом режиме). Спасибо!
      </Placeholder>
    );
  }

  return (
    <div className="absolute inset-x-3 top-1.75 bottom-2 flex flex-col gap-2">
      {reportingMistake ? (
        <div className="pl-3 text-sm text-muted-foreground">
          Аккаунт уже маркирован. Если вы считаете это ошибкой, напишите,
          почему.
        </div>
      ) : (
        <Select
          disabled={submitting}
          onValueChange={(value) => {
            setReportResult(undefined);
            setTagId(
              value === emptySelectValue ? undefined : tagIdSchema.parse(value),
            );
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Выберите подходящую маркировку для этого аккаунта..." />
          </SelectTrigger>
          <SelectContent>
            {filteredTags.map((tag) => (
              <SelectItem
                key={tag.id}
                value={tag.name}
                className="flex items-center gap-2"
              >
                <span
                  className="size-2 rounded-full bg-muted"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Textarea
        disabled={submitting}
        className="w-full flex-1 resize-none"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
        }}
      />
      <input type="hidden" value={vkDomain} />
      <div className="flex h-10 items-center justify-between">
        {reportResult?.success === false ? (
          <div className="pl-3 text-sm text-destructive">
            {reportResult.errorMessage}
          </div>
        ) : (
          <div
            className={cn(
              "pl-3 text-sm text-muted-foreground",
              text.length > maxLength && "text-warning",
            )}
          >
            {text.length} / {maxLength} символов
          </div>
        )}
        <ButtonWithLoadingState
          disabled={Boolean(reportResult)}
          loading={submitting}
          onClick={() => {
            void report();
          }}
        >
          <SendIcon />{" "}
          {reportingMistake
            ? "Сообщить о неправильной маркировке"
            : "Отправить"}
        </ButtonWithLoadingState>
      </div>
    </div>
  );
}
