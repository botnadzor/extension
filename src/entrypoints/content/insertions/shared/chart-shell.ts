import { cn } from "@/shared/tailwindcss-helpers";

export type ChartDomShell = {
  wrapper: HTMLElement;
  canvas: HTMLCanvasElement;
  info: HTMLElement;
  updateInfoText: (text: string) => void;
  stopAutoLoad: () => void;
  hideAutoLoadButton: () => void;
  destroy: () => void;
};

export function createChartShell(
  host: Element,
  initialInfoText: string,
): ChartDomShell {
  const wrapper = document.createElement("div");
  wrapper.className = cn(`
    bn:mt-4 bn:mb-8 bn:box-border bn:block bn:h-[260px] bn:w-full
  `);

  const canvas = document.createElement("canvas");
  canvas.className = cn("bn:box-border bn:block bn:size-full");

  const info = document.createElement("div");
  info.className = cn(
    "bn:mt-0 bn:ml-4 bn:text-[13px] bn:leading-snug bn:text-foreground",
  );

  const infoText = document.createElement("span");
  infoText.textContent = initialInfoText;
  const infoButton = document.createElement("button");
  infoButton.type = "button";
  infoButton.className = cn(`
    bn:mb-2 bn:inline-block bn:cursor-pointer bn:border-0 bn:border-b
    bn:border-dashed bn:border-[#3b82f640] bn:bg-transparent bn:p-0
    bn:text-[13px] bn:text-border-link
    bn:hover:border-current
  `);
  infoButton.textContent = "Включить автозагрузку";

  let autoLoadIntervalId: ReturnType<typeof setInterval> | undefined;
  let isAutoLoadStopped = false;

  function startAutoLoad() {
    if (isAutoLoadStopped) {
      return;
    }

    if (autoLoadIntervalId !== undefined) {
      clearInterval(autoLoadIntervalId);
    }

    infoButton.textContent = "Остановить автозагрузку";
    autoLoadIntervalId = setInterval(() => {
      const loadMoreButton = document.querySelector<HTMLButtonElement>(
        "button.ui_load_more_btn",
      );
      if (loadMoreButton) {
        loadMoreButton.click();
      }
    }, 1000);
  }

  function stopAutoLoad() {
    if (autoLoadIntervalId !== undefined) {
      clearInterval(autoLoadIntervalId);
      autoLoadIntervalId = undefined;
    }
    infoButton.textContent = "Включить автозагрузку";
  }

  function permanentlyStopAutoLoad() {
    stopAutoLoad();
    isAutoLoadStopped = true;
  }

  function handleButtonClick() {
    if (autoLoadIntervalId === undefined) {
      startAutoLoad();
    } else {
      stopAutoLoad();
    }
  }

  infoButton.addEventListener("click", handleButtonClick);

  info.append(infoText, document.createElement("br"), infoButton);

  wrapper.append(canvas);
  wrapper.append(info);
  host.before(wrapper);

  return {
    wrapper,
    canvas,
    info,
    updateInfoText(text: string) {
      infoText.textContent = text;
    },
    stopAutoLoad() {
      permanentlyStopAutoLoad();
    },
    hideAutoLoadButton() {
      infoButton.style.display = "none";
    },
    destroy() {
      permanentlyStopAutoLoad();
      infoButton.removeEventListener("click", handleButtonClick);
      wrapper.remove();
    },
  };
}

export function observeFansRowsUpdates(
  root: Element,
  onChange: () => Promise<void> | void,
): () => void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        void onChange();
        break;
      }
    }
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
  });

  return () => {
    observer.disconnect();
  };
}
