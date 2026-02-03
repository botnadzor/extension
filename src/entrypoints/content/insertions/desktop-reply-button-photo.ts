import { frontendService } from "@/shared/proxy-services";

import { defineInsertion } from "../insertion-basics";
import { setupAnswerBot } from "./shared/ui-answer-bot-button-photo-comment";

export default defineInsertion({
  appliesTo: "desktopVkWebsite",
  elementSelector: ".reply_text_wrapper",

  init: async ({ element }) => {
    const replyForm = element.closest(".reply_form");
    if (!(replyForm instanceof HTMLElement)) {
      return;
    }

    const replyTargetInputRaw = replyForm.querySelector(
      'input[type="hidden"][id^="reply_to-"]',
    );
    if (!(replyTargetInputRaw instanceof HTMLInputElement)) {
      return;
    }

    const emojiButtonRaw = element.querySelector('[data-testid="emoji-smile"]');
    if (!(emojiButtonRaw instanceof HTMLElement)) {
      return;
    }

    const emojiButtonContainerRaw = element.querySelector(
      ".emoji_smile_wrap._emoji_wrap",
    );

    if (!(emojiButtonContainerRaw instanceof HTMLElement)) {
      return;
    }

    const replyTargetInput = replyTargetInputRaw;
    const emojiButton = emojiButtonRaw;
    const emojiButtonContainer = emojiButtonContainerRaw;

    const input =
      element.querySelector<HTMLElement>(".reply_field.submit_post_field") ??
      element;

    const frontendBaseUrl = await frontendService.getBaseUrl();
    const cleanup = setupAnswerBot({
      replyTargetInput,
      emojiButtonContainer,
      emojiButton,
      input,
      frontendBaseUrl,
    });

    return () => {
      cleanup();
    };
  },
});
