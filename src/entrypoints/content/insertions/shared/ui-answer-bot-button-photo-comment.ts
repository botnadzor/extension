import type { VkDomain } from "@/shared/@model/primitives";
import { affiliationService } from "@/shared/proxy-services";

import { renderAnswerBotAction } from "./ui-answer-bot-button";
import { extractVkDomainFromReplyInputValue } from "./vk-identifies";

type SetupAnswerBotOptions = {
  replyTargetInput: HTMLInputElement;
  emojiButtonContainer: HTMLElement;
  emojiButton: HTMLElement;
  input: HTMLElement;
  frontendBaseUrl: string;
};

export function setupAnswerBot({
  replyTargetInput,
  emojiButtonContainer,
  emojiButton,
  input,
  frontendBaseUrl,
}: SetupAnswerBotOptions): () => void {
  const prevDisplay = emojiButtonContainer.style.display;
  let answerBotReply: ReturnType<typeof renderAnswerBotAction> | undefined;

  function destroyButton() {
    if (!answerBotReply) {
      return;
    }
    answerBotReply.element.remove();
    answerBotReply.destroy();
    answerBotReply = undefined;
  }

  function restoreEmojiButtonContainerDisplay() {
    if (prevDisplay) {
      emojiButtonContainer.style.display = prevDisplay;
    } else {
      emojiButtonContainer.style.removeProperty("flex");
    }
  }

  function hideButton() {
    destroyButton();
    restoreEmojiButtonContainerDisplay();
  }

  function showButton(vkDomain: VkDomain): void {
    emojiButtonContainer.style.display = "flex";
    destroyButton();

    answerBotReply = renderAnswerBotAction({
      vkDomain,
      frontendBaseUrl,
      onClickHandlerTarget: input,
      showTooltip: true,
    });

    emojiButton.before(answerBotReply.element);
  }

  async function syncWithReplyTarget(): Promise<void> {
    const vkDomain = extractVkDomainFromReplyInputValue(replyTargetInput);

    if (!vkDomain) {
      hideButton();
      return;
    }

    const accountAffiliation = await affiliationService.checkAccount(vkDomain);

    if (!accountAffiliation) {
      hideButton();
      return;
    }

    showButton(vkDomain);
  }

  void syncWithReplyTarget();

  const observer = new MutationObserver(() => {
    void syncWithReplyTarget();
  });

  observer.observe(replyTargetInput, {
    attributes: true,
    attributeFilter: ["value"],
  });

  function handleChange() {
    void syncWithReplyTarget();
  }

  replyTargetInput.addEventListener("change", handleChange);
  replyTargetInput.addEventListener("input", handleChange);

  return () => {
    observer.disconnect();
    replyTargetInput.removeEventListener("change", handleChange);
    replyTargetInput.removeEventListener("input", handleChange);

    hideButton();
  };
}
