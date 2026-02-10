import { vkDomainSchema } from "@/shared/@primitives/vk";
import { affiliationService, frontendService } from "@/shared/proxy-services";
import { cn } from "@/shared/tailwindcss-helpers";

import { defineInsertion } from "../insertion-basics";
import { renderAnswerBotAction } from "./shared/ui-answer-bot-button";

function extractTargetCommentId(replyInput: HTMLInputElement): string {
  const postId = replyInput.id.split("-")[1]?.split("_")[0] ?? "";
  const commentId = replyInput.value;
  return `post-${postId}_${commentId}`;
}

function getBotAuthorId(
  commentElement: HTMLElement,
): string | null | undefined {
  return commentElement.dataset["answeringId"];
}

export default defineInsertion({
  appliesTo: "desktopVkWebsite",
  elementSelector: ".reply_box_more_attaches",

  init: async ({ element, logger }) => {
    const replyForm = element.closest(".reply_form");
    if (!(replyForm instanceof HTMLElement)) {
      return;
    }

    const replyTargetInput = replyForm.querySelector(
      'input[type="hidden"][id^="reply_to-"]',
    );
    if (!(replyTargetInput instanceof HTMLInputElement)) {
      return;
    }

    const replyTargetValue = replyTargetInput.value.trim();
    if (!replyTargetValue) {
      return;
    }

    const targetCommentId = extractTargetCommentId(replyTargetInput);
    const targetCommentElement = document.querySelector(`#${targetCommentId}`);
    if (!(targetCommentElement instanceof HTMLElement)) {
      return;
    }

    const botAuthorId = getBotAuthorId(targetCommentElement);
    const vkDomain = vkDomainSchema.safeParse(`id${botAuthorId}`).data;
    if (!vkDomain) {
      logger.warn(
        `Unable to parse vkDomain from reply target value="${replyTargetValue}"`,
      );
      return;
    }

    const accountAffiliation = await affiliationService.checkAccount(vkDomain);

    if (!accountAffiliation) {
      return;
    }

    const inputIdPart = replyTargetInput.id.split("-")[1] ?? "";
    const trueInputSelector = `#reply_field-${inputIdPart}`;
    const trueInput = replyForm.querySelector(trueInputSelector);
    if (!(trueInput instanceof HTMLElement)) {
      return;
    }

    const frontendBaseUrl = await frontendService.getBaseUrl();
    const answerBotButton = renderAnswerBotAction({
      vkDomain,
      frontendBaseUrl,
      className: cn("bn:absolute bn:top-0.5 bn:right-[90px]"),
      showTooltip: true,
      onClickHandlerTarget: trueInput,
    });

    element.insertAdjacentElement("afterend", answerBotButton.element);

    return () => {
      answerBotButton.destroy();
    };
  },
});
