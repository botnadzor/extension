import { vkIdSchema } from "@/lib/primitive-values";
import {
  affiliationService,
  frontendService,
  inspectorService,
  userService,
} from "@/lib/proxy-services";
import type { InspectorInstancePayload } from "@/services/inspector-service";

import type { Insertion } from "../insertion-basics";
import { extractVkDomain } from "./desktop-popup-post";
import { createChartShell, observeFansRowsUpdates } from "./shared/chart-shell";
import { renderActionButton } from "./shared/ui-action-buttons";
import { getVkDomainFromRow } from "./shared/vk-identifies";

function getNumericIdFromDomain(domain: string): number | undefined {
  const match = /^id(\d+)$/.exec(domain);
  if (!match) {
    return;
  }

  const id = Number(match[1]);
  if (!Number.isFinite(id)) {
    return;
  }

  return id;
}

function getTotalCountFromPage(element: Element): number {
  const totalCountText =
    element.parentElement?.parentElement
      ?.querySelector<HTMLDivElement>(".ui_tab_sel")
      ?.textContent.replaceAll(/\D/g, "") ??
    element.parentElement?.parentElement
      ?.querySelector<HTMLDivElement>(".wk_voting_option_count_extended")
      ?.textContent.replaceAll(/\D/g, "") ??
    "0";

  return Number.parseInt(totalCountText, 10);
}

function extractVkDomainsAndIds(rows: HTMLElement[]): {
  vkDomains: string[];
  vkNumericIds: number[];
} {
  const vkDomains: string[] = [];
  const vkNumericIds: number[] = [];

  for (const row of rows) {
    const vkDomain = getVkDomainFromRow(row);
    if (vkDomain === undefined) {
      continue;
    }

    const numericId = getNumericIdFromDomain(vkDomain);
    if (numericId === undefined) {
      continue;
    }

    vkDomains.push(vkDomain);
    vkNumericIds.push(numericId);
  }

  return { vkDomains, vkNumericIds };
}

const insertion: Insertion = {
  appliesTo: "desktopVkWebsite",
  elementSelector: ".fans_rows",

  init: async ({ contentId, element, logger }) => {
    const frontendBaseUrl = await frontendService.getBaseUrl();
    const userConfig = await userService.getConfig();

    const chartModule = await import("chart.js/auto");
    const {
      Chart,
      BarController,
      BarElement,
      CategoryScale,
      LinearScale,
      Legend,
      Tooltip,
    } = chartModule;

    Chart.register(
      BarController,
      BarElement,
      CategoryScale,
      Legend,
      LinearScale,
      Tooltip,
    );

    const totalCount = getTotalCountFromPage(element);

    const shell = createChartShell(
      element,
      `График показан только для загруженных аккаунтов. Подгрузка происходит, когда вы скроллите окно вниз. Соцсеть может скрывать некоторых лайкнувших. Загружено: 0 / ${totalCount} `,
    );

    const ctx = shell.canvas.getContext("2d");
    if (!ctx) {
      logger.warn("likes-chart: 2d context not available");
      shell.destroy();
      return;
    }

    const styles = getComputedStyle(shell.wrapper);
    const colorOther = styles.getPropertyValue("--bn-color-followers-other");
    const colorBots = styles.getPropertyValue("--bn-color-followers-bots");

    const chart = new Chart<"bar", number[], string>(ctx, {
      type: "bar",
      data: {
        labels: [],
        datasets: [
          {
            label: "Другие аккаунты",
            data: [0],
            backgroundColor: colorOther,
            stack: "bots",
            barPercentage: 1,
            categoryPercentage: 0.7,
          },
          {
            label: "Подтвержденные боты",
            data: [0],
            backgroundColor: colorBots,
            stack: "bots",
            barPercentage: 1,
            categoryPercentage: 0.7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            align: "center",
            reverse: true,
          },
          tooltip: {
            enabled: true,
          },
        },
        scales: {
          x: {
            stacked: true,
            offset: true,
            grid: {
              display: false,
            },
            border: {
              display: true,
            },
            title: {
              display: true,
              text: "Диапазон id аккаунтов (миллионы)",
            },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              stepSize: 1,
            },
            grid: {
              display: true,
              drawOnChartArea: true,
              drawTicks: false,
            },
            border: {
              display: true,
            },
            title: {
              display: true,
              text: "Количество аккаунтов",
            },
          },
        },
      },
    });

    let isUpdating = false;
    let pendingUpdate = false;
    let isDestroyed = false;

    async function handleTableView(likesDisplay: string) {
      if (likesDisplay !== "table" && pendingUpdate) {
        return;
      }

      const container = document.querySelector(".fans_rows");

      if (!(container instanceof HTMLElement)) {
        return;
      }

      const dataset = [...container.childNodes]
        .filter((el): el is HTMLElement => el instanceof HTMLElement)
        .map((el) => {
          const linkElement = el.querySelector("a.fans_fan_lnk");
          if (!(linkElement instanceof HTMLAnchorElement)) {
            return;
          }

          const vkDomain = extractVkDomain(linkElement);
          if (!vkDomain) {
            return;
          }

          const numericId = el.dataset["id"] ?? undefined;
          const name = linkElement.textContent;
          const image =
            el.querySelector("img.fans_fan_img")?.getAttribute("src") ?? "";

          // TODO: Implement logic to parse comment IDs
          const inspectorInstancePayload: InspectorInstancePayload = {
            wallVkId: vkIdSchema.parse(1),
            postVkId: vkIdSchema.parse(1),
            commentVkId: vkIdSchema.parse(1),
            commenterVkDomain: vkDomain,
            commenterName: name,
            commenterAvatarUrl: image,
          };

          return {
            link: linkElement.getAttribute("href") ?? "",
            image,
            name,
            profile: el.dataset["id"] ?? "",
            vkDomain,
            numericId,
            inspectorInstancePayload,
          };
        });

      // Fetch affiliations for all accounts
      const affiliations = await Promise.all(
        dataset.map((item) =>
          item?.vkDomain
            ? affiliationService.checkAccount(item.vkDomain)
            : Promise.resolve(undefined),
        ),
      );

      container.textContent = "";

      const table = document.createElement("table");
      table.className =
        "bn:w-full bn:border-collapse bn:color-[var(--vkui--color_text_primary)]";
      const tbody = document.createElement("tbody");

      for (const [index, item] of dataset.entries()) {
        const row = document.createElement("tr");

        // Column 1: Index
        const indexCell = document.createElement("td");
        indexCell.className = "bn:font-mono";
        indexCell.textContent = String(index + 1);
        row.append(indexCell);

        // Column 2: VK Numeric ID
        const idCell = document.createElement("td");
        idCell.className = "bn:font-mono bn:text-center";
        idCell.textContent = item?.numericId ?? "";
        row.append(idCell);

        // Column 3: Avatar + Name
        const nameCell = document.createElement("td");
        const nameWrapper = document.createElement("div");
        nameWrapper.className = "bn:flex bn:items-center bn:gap-2";

        const avatarWrapper = document.createElement("div");
        avatarWrapper.className =
          "bn:w-6 bn:h-6 bn:flex bn:items-center bn:group/avatar";

        const avatarImg = document.createElement("img");
        avatarImg.className =
          "bn:w-full bn:pointer-events-none group-hover/avatar:bn:scale-[10]";
        avatarImg.src = item?.image ?? "";
        avatarWrapper.append(avatarImg);

        const nameLink = document.createElement("a");
        nameLink.href = item?.link ?? "";
        nameLink.target = "_blank";
        nameLink.rel = "noreferrer";
        nameLink.style.color = "var(--vkui--color_text_primary)";
        nameLink.textContent = item?.name ?? "";

        nameWrapper.append(avatarWrapper, nameLink);
        nameCell.append(nameWrapper);
        row.append(nameCell);

        // Column 4: Affiliation
        const affiliationCell = document.createElement("td");
        const affiliationDiv = document.createElement("div");
        affiliationDiv.className = "bn:text-center bn:p-1";
        if (affiliations[index]) {
          affiliationDiv.style.background = affiliations[index].color;
          affiliationDiv.textContent = affiliations[index].tags[0].name;
        }
        affiliationCell.append(affiliationDiv);
        row.append(affiliationCell);

        // Column 5: Actions
        const actionsCell = document.createElement("td");
        actionsCell.className = "bn:relative";
        const actionsWrapper = document.createElement("div");
        actionsWrapper.className =
          "bn:text-center bn:flex bn:gap-2 bn:justify-end bn:h-full";

        const iconClasses =
          "bn:opacity-50 bn:size-4 bn:!fill-[var(--vkui--color_text_primary)]";

        const actionUi = renderActionButton({
          icons: [
            {
              id: "squareMenu",
              kind: "link",
              href:
                frontendBaseUrl + "/account/" + String(item?.vkDomain ?? ""),
            },
            {
              id: "userSearch",
              kind: "button",
              onClick: () => {
                void inspectorService.trigger(
                  contentId,
                  item?.inspectorInstancePayload,
                );
              },
            },
          ],
          containerClassName:
            "bn:flex-center bn:flex bn:gap-2 bn:justify-end bn:h-full",
          actionClassName: iconClasses,
        });

        actionsWrapper.append(actionUi.element);
        actionsCell.append(actionsWrapper);
        row.append(actionsCell);

        tbody.append(row);
      }

      table.append(tbody);
      container.append(table);
    }

    async function updateChartFromDom() {
      if (isUpdating) {
        pendingUpdate = true;
        return;
      }

      if (isDestroyed) {
        return;
      }

      isUpdating = true;
      pendingUpdate = false;

      try {
        const rows = [
          ...element.querySelectorAll<HTMLElement>(".fans_fan_row"),
        ];

        const loadCount = rows.length;

        shell.updateInfoText(
          `График показан только для загруженных аккаунтов. Подгрузка происходит, когда вы скроллите окно вниз. Соцсеть может скрывать некоторых лайкнувших. Загружено: ${loadCount} / ${totalCount} `,
        );

        function checkLoadMoreButton() {
          const loadMoreButton = document.querySelector(
            "button.ui_load_more_btn",
          );

          if (!(loadMoreButton instanceof HTMLElement)) {
            return false;
          }

          if (loadMoreButton.style.display === "none") {
            return false;
          }

          return true;
        }

        if (!checkLoadMoreButton() || loadCount >= totalCount) {
          shell.stopAutoLoad();
          shell.hideAutoLoadButton();
        }

        const { vkDomains, vkNumericIds } = extractVkDomainsAndIds(rows);
        const loadedCount = vkDomains.length;

        const datasets = chart.data.datasets;
        if (!Array.isArray(datasets) || datasets.length < 2) {
          logger.warn("followers-chart: expected at least 2 datasets");
          return;
        }

        const otherDataset = datasets[0];
        const botsDataset = datasets[1];

        if (!(otherDataset && botsDataset)) {
          logger.warn("followers-chart: dataset items missing");
          return;
        }

        if (loadedCount === 0) {
          chart.data.labels = ["0"];
          otherDataset.data = [0];
          botsDataset.data = [0];
          chart.update();

          return;
        }

        const accountAffiliations = await Promise.all(
          vkDomains.map((vkDomain) =>
            affiliationService.checkAccount(vkDomain),
          ),
        );

        const buckets = new Map<number, { bots: number; other: number }>();

        for (let i = 0; i < loadedCount; i++) {
          const id = vkNumericIds[i];
          const accountAffiliation = accountAffiliations[i];

          if (id === undefined) {
            continue;
          }

          const bucketIndex = Math.floor(id / 1_000_000);

          let bucket = buckets.get(bucketIndex);
          if (!bucket) {
            bucket = { bots: 0, other: 0 };
            buckets.set(bucketIndex, bucket);
          }

          if (accountAffiliation) {
            bucket.bots += 1;
          } else {
            bucket.other += 1;
          }
        }

        const sortedBuckets = [...buckets.entries()].toSorted(
          ([a], [b]) => a - b,
        );

        const labels: string[] = [];
        const otherData: number[] = [];
        const botsData: number[] = [];

        for (const [bucketIndex, counts] of sortedBuckets) {
          labels.push(String(bucketIndex));
          otherData.push(counts.other);
          botsData.push(counts.bots);
        }

        chart.data.labels = labels;
        otherDataset.data = otherData;
        botsDataset.data = botsData;

        chart.update();
      } finally {
        isUpdating = false;

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Values can be modified by concurrent calls or cleanup
        if (pendingUpdate && !isDestroyed) {
          void updateChartFromDom();
        }
      }
    }

    await updateChartFromDom();

    const disconnect = observeFansRowsUpdates(element, updateChartFromDom);

    await handleTableView(userConfig.likesDisplay);

    return () => {
      isDestroyed = true;
      disconnect();
      chart.destroy();
      shell.destroy();
    };
  },
};

export default insertion;
