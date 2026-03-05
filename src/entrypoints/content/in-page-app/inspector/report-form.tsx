import { SendHorizontalIcon } from "lucide-react";
import * as React from "react";

import {
  type InspectorTrigger,
  reportTextMaxLength,
} from "@/shared/@model/inspector";
import {
  type TagId,
  tagIdSchema,
  type TagSuggestion,
  tagSuggestionSchema,
} from "@/shared/@primitives/misc";
import type { VkDomain } from "@/shared/@primitives/vk";
import {
  useAccountInspection,
  useAuthStatus,
  useFrontendBaseUrl,
  useStaticListItems,
} from "@/shared/@ui-helpers/data-hooks";
import { useAnimate } from "@/shared/@ui-helpers/use-animate";
import { Button } from "@/shared/@ui-primitives/button";
import { ButtonWithLoadingState } from "@/shared/@ui-primitives/button-with-loading-state";
import {
  emptySelectValue,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/@ui-primitives/select";
import { Textarea } from "@/shared/@ui-primitives/textarea";
import { inspectorService } from "@/shared/proxy-services";
import { cn } from "@/shared/tailwindcss-helpers";

import { Placeholder } from "./placeholder";

export function ReportForm({
  vkDomain,
  trigger,
}: {
  vkDomain: VkDomain;
  trigger: InspectorTrigger;
}) {
  const accountInspection = useAccountInspection(vkDomain);
  const tags = useStaticListItems("tags");
  const authStatus = useAuthStatus();
  const frontendBaseUrl = useFrontendBaseUrl();
  const filteredTags = tags.filter((tag) => /^\d/.exec(tag.id));

  const [tagId, setTagId] = React.useState<TagId | undefined>();
  const [text, setText] = React.useState("");

  const selectedTag = tags.find((tag) => tag.id === tagId);

  const [reportSubmission, setReportSubmission] = React.useState<
    Awaited<ReturnType<typeof inspectorService.submitReport>> | undefined
  >();
  const [submitting, setSubmitting] = React.useState(false);

  const reportingInvalidTag =
    !accountInspection.problem && accountInspection.legacy.mark;

  const selectElementRef = React.useRef<HTMLButtonElement>(null);
  const textElementRef = React.useRef<HTMLTextAreaElement>(null);

  const { animate: animateSelect, animationClassName: shakeSelectClassName } =
    useAnimate();
  const { animate: animateText, animationClassName: shakeTextClassName } =
    useAnimate();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const formTagSuggestion = formData.get("tagSuggestion");
    const formText = formData.get("text");

    const parsedTagIdSuggestion =
      typeof formTagSuggestion === "string" &&
      formTagSuggestion !== emptySelectValue
        ? tagSuggestionSchema.parse(formTagSuggestion)
        : undefined;

    if (!parsedTagIdSuggestion) {
      setReportSubmission({
        problem: true,
        type: "bn:ext:invalid-payload",
        description: "Выберите подходящую маркировку для этого аккаунта",
        fields: ["tagSuggestion"],
      });
      return;
    }

    setSubmitting(true);

    void inspectorService
      .submitReport({
        tagSuggestion: parsedTagIdSuggestion,
        text: typeof formText === "string" ? formText : "",
        trigger,
        vkDomain,
      })
      .then((submission) => {
        setSubmitting(false);
        setReportSubmission(submission);
      });
  }

  React.useEffect(() => {
    if (!reportSubmission || !("errorKind" in reportSubmission)) {
      return;
    }

    let timeoutId: NodeJS.Timeout | undefined;

    if (reportSubmission.errorKind === "invalidTagSuggestion") {
      animateSelect("shake");
      timeoutId = setTimeout(() => {
        selectElementRef.current?.focus();
      }, 100);
    }
    if (reportSubmission.errorKind === "invalidText") {
      animateText("shake");
      timeoutId = setTimeout(() => {
        textElementRef.current?.focus();
      }, 100);
    }

    if (!timeoutId) {
      return;
    }

    return () => {
      clearTimeout(timeoutId);
    };
  }, [animateSelect, animateText, reportSubmission]);

  if (
    accountInspection.problem &&
    accountInspection.type !== "bn:ext:not-found" &&
    accountInspection.type !== "bn:ext:unforeseen-error" &&
    accountInspection.type !== "bn:ext:local:contract-error"
  ) {
    return (
      <Placeholder className="bg-destructive/10 text-destructive">
        {accountInspection.description || accountInspection.type}
      </Placeholder>
    );
  }

  if (reportSubmission && !reportSubmission.problem) {
    return <Placeholder>{reportSubmission.message}</Placeholder>;
  }

  if (
    authStatus.state !== "valid" ||
    !authStatus.permissionLookup.reportAccount
  ) {
    return (
      <Placeholder>
        <div>
          Чтобы отправлять аккаунты на проверку, нужно иметь боле высокий
          уровень доступа или достаточное количество очков.
          <br />
          <br />
          Подробнее —{" "}
          <a
            className="u-link"
            href={`${frontendBaseUrl}/docs/extension#inspector`}
            rel="noopener noreferrer"
            target="_blank"
          >
            в справке
          </a>
          .
        </div>
      </Placeholder>
    );
  }

  return (
    <form
      className="absolute inset-x-3 top-1.75 bottom-2 flex flex-col gap-2"
      onSubmit={handleSubmit}
    >
      <input type="hidden" value={vkDomain} />
      {reportingInvalidTag ? (
        <>
          <div className="pt-1.75 pb-2 pl-3 text-sm text-muted-foreground">
            Аккаунт уже маркирован. Если вы считаете это ошибкой, напишите,
            почему.
          </div>
          <input
            type="hidden"
            name="tagSuggestion"
            value={"untagged" satisfies TagSuggestion}
          />
        </>
      ) : (
        <Select
          name="tagSuggestion"
          items={Object.fromEntries(
            filteredTags.map((tag) => [tag.id, tag.name]),
          )}
          disabled={submitting}
          onValueChange={(value) => {
            setReportSubmission(undefined);
            setTagId(
              !value || value === emptySelectValue
                ? undefined
                : tagIdSchema.parse(value),
            );
          }}
          value={tagId ?? emptySelectValue}
        >
          <SelectTrigger
            className={cn("w-full", shakeSelectClassName)}
            ref={selectElementRef}
          >
            <SelectValue>
              {selectedTag ? (
                <span className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full bg-muted"
                    style={{ backgroundColor: selectedTag.color }}
                  />
                  {selectedTag.name}
                </span>
              ) : (
                <span>Выберите подходящую маркировку для этого аккаунта</span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={emptySelectValue}>
              Маркировка не выбрана
            </SelectItem>
            {filteredTags.map((tag) => (
              <SelectItem
                key={tag.id}
                value={tag.id}
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
        className={cn("w-full flex-1 resize-none", shakeTextClassName)}
        name="text"
        placeholder="Опишите ситуацию ёмко и исчерпывающе"
        value={text}
        onChange={(e) => {
          setReportSubmission(undefined);
          setText(e.target.value);
        }}
        ref={textElementRef}
      />

      <div className="flex h-10 items-center justify-between gap-2">
        {reportSubmission ? (
          <>
            <div className="flex-1 truncate pl-3 text-sm text-destructive">
              {reportSubmission.description}
            </div>
            <Button
              variant="destructive"
              onClick={() => {
                setReportSubmission(undefined);
              }}
            >
              Понятно
            </Button>
          </>
        ) : (
          <>
            <div
              className={cn(
                "pl-3 text-sm text-muted-foreground",
                text.length > reportTextMaxLength && "text-warning",
              )}
            >
              {text.length} / {reportTextMaxLength} символов
            </div>
            <ButtonWithLoadingState
              disabled={Boolean(reportSubmission)}
              loading={submitting}
              type="submit"
            >
              {reportingInvalidTag
                ? "Сообщить о неправильной маркировке"
                : "Отправить"}
              <SendHorizontalIcon className="size-4" />
            </ButtonWithLoadingState>
          </>
        )}
      </div>
    </form>
  );
}
