import type { InspectorInstancePayload } from "@/shared/@model/inspector";
import { vkIdSchema } from "@/shared/@primitives/vk";
import {
  affiliationService,
  frontendService,
  inspectorService,
  userConfigService,
} from "@/shared/proxy-services";
import { cn } from "@/shared/tailwindcss-helpers";

import { defineInsertion } from "../insertion-basics";
import { extractVkDomain } from "./desktop-popup-post";
import { createChartShell, observeFansRowsUpdates } from "./shared/chart-shell";
import { renderActionButton } from "./shared/ui-action-buttons";
import { getVkDomainFromRow } from "./shared/vk-identifies";

function getNumericIdFromNumericDomain(domain: string): number | undefined {
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

function getUserNumericIdFromElement(el: HTMLElement): string {
  if (el.dataset["id"]) {
    return el.dataset["id"];
  }

  const childWithData = el.querySelector(
    'div[data-testid*="followers-modal-user-cell"]',
  );

  if (!(childWithData instanceof HTMLElement)) {
    return "0";
  }

  if (!childWithData.dataset["testid"]) {
    return "0";
  }

  return childWithData.dataset["testid"].split("-").pop() ?? "0";
}

function getTotalCountFromPage(element: Element): number {
  const container = element.parentElement?.parentElement;
  if (!container) {
    return 0;
  }

  const selectors = [
    ".ui_tab_sel",
    ".wk_voting_option_count_extended",
    ".vkuiTabsItem__status", // New VK design
  ];

  for (const selector of selectors) {
    const countElement = container.querySelector<HTMLDivElement>(selector);
    if (countElement?.textContent) {
      const digitsOnly = countElement.textContent.replaceAll(/\D/g, "");
      if (digitsOnly) {
        return Number.parseInt(digitsOnly, 10);
      }
    }
  }

  return 0;
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

    const numericId = getNumericIdFromNumericDomain(vkDomain);
    if (numericId === undefined) {
      continue;
    }

    vkDomains.push(vkDomain);
    vkNumericIds.push(numericId);
  }

  return { vkDomains, vkNumericIds };
}

export default defineInsertion({
  appliesTo: "desktopVkWebsite",
  elementSelector: [
    ".fans_rows",
    ".vkitInternalModalBox", // New VK design
  ].join(", "),

  init: async ({ contentId, element, logger }) => {
    const frontendBaseUrl = await frontendService.getBaseUrl();

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

    const shellHost = element.classList.contains(".fans_rows")
      ? element
      : element.querySelector(".vkuiCustomScrollView__host");
    if (!shellHost) {
      return;
    }

    const shell = createChartShell(
      shellHost,
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

    function extractDatasetFromContainer(container: HTMLElement) {
      // Filter out table elements and only get div children
      const childElements = [...container.children].filter(
        (el): el is HTMLElement =>
          el instanceof HTMLElement && el.tagName !== "TABLE",
      );

      const datasetSource =
        childElements.map((el) => {
          return el.dataset["testid"] && el.dataset["testid"] === "modalheader";
        }).length > 0
          ? [
              ...container.querySelectorAll("div[class*=vkitGridItem__root]"),
            ].filter((el) => el.tagName !== "TABLE")
          : childElements;

      return datasetSource
        .filter((el): el is HTMLElement => el instanceof HTMLElement)
        .map((el) => {
          const linkElement = el.querySelector(
            [
              "a.fans_fan_lnk",
              "a[class*=vkitLink__link]", // New VK design
            ].join(", "),
          );
          if (!(linkElement instanceof HTMLAnchorElement)) {
            return;
          }

          const vkDomain = extractVkDomain(linkElement);
          if (!vkDomain) {
            return;
          }

          const numericId = getUserNumericIdFromElement(el);

          const name = linkElement.textContent;
          const avatarUrl = el.querySelector("img")?.getAttribute("src") ?? "";

          const inspectorInstancePayload: InspectorInstancePayload = {
            accountInfo: {
              vkDomain,
              name,
              avatarUrl,
            },
            trigger: {
              type: "comment",
              // TODO: Implement logic to parse comment IDs
              postType: "wall",
              wallVkId: vkIdSchema.parse(1),
              postVkId: vkIdSchema.parse(1),
              commentVkId: vkIdSchema.parse(1),
            },
          };

          return {
            link: linkElement.getAttribute("href") ?? "",
            image: avatarUrl,
            name,
            profile: el.dataset["id"] ?? "",
            vkDomain,
            numericId,
            inspectorInstancePayload,
          };
        });
    }

    function createTableRow(
      index: number,
      item:
        | {
            link: string;
            image: string;
            name: string | null;
            profile: string;
            vkDomain: string;
            numericId: string;
            inspectorInstancePayload: InspectorInstancePayload;
          }
        | undefined,
      affiliation:
        | {
            color: string;
            tags: Array<{ name: string }>;
          }
        | undefined,
    ): HTMLTableRowElement {
      const row = document.createElement("tr");

      // Column 1: Index
      const indexCell = document.createElement("td");
      indexCell.className = cn("bn:font-mono");
      indexCell.textContent = String(index + 1);
      row.append(indexCell);

      // Column 2: VK Numeric ID
      const idCell = document.createElement("td");
      idCell.className = cn("bn:text-center bn:font-mono");
      idCell.textContent = item?.numericId ?? "";
      row.append(idCell);

      // Column 3: Avatar + Name
      const nameCell = document.createElement("td");
      const nameWrapper = document.createElement("div");
      nameWrapper.className = cn("bn:flex bn:items-center bn:gap-2");

      const avatarWrapper = document.createElement("div");
      avatarWrapper.className = `
            bn:group/avatar
            bn:flex bn:size-6 bn:items-center
          `;

      const avatarImg = document.createElement("img");
      avatarImg.className = `
            bn:pointer-events-none bn:w-full
            bn:group-hover/avatar:scale-[10]
          `;
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
      affiliationDiv.className = cn("bn:p-1 bn:text-center");
      if (affiliation) {
        affiliationDiv.style.background = affiliation.color;
        affiliationDiv.textContent = affiliation.tags[0]?.name ?? "";
      }
      affiliationCell.append(affiliationDiv);
      row.append(affiliationCell);

      // Column 5: Actions
      const actionsCell = document.createElement("td");
      actionsCell.className = cn("bn:relative");
      const actionsWrapper = document.createElement("div");
      actionsWrapper.className = cn(
        "bn:flex bn:h-full bn:justify-end bn:gap-2 bn:text-center",
      );

      const iconClasses = cn(
        "bn:size-4 bn:fill-(--vkui--color_text_primary)! bn:opacity-50",
      );

      const actionUi = renderActionButton({
        icons: [
          {
            id: "squareMenu",
            kind: "link",
            href: frontendBaseUrl + "/account/" + (item?.vkDomain ?? ""),
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
        containerClassName: cn(
          "bn:flex bn:h-full bn:items-center bn:justify-end bn:gap-2",
        ),
        actionClassName: iconClasses,
      });

      actionsWrapper.append(actionUi.element);
      actionsCell.append(actionsWrapper);
      row.append(actionsCell);

      return row;
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
        const currentUserConfig = await userConfigService.get();
        const container = element.classList.contains("fans_rows")
          ? element
          : element.querySelector('[class*="vkitGrid__root"]'); // New VK design

        if (!container || !(container instanceof HTMLElement)) {
          return;
        }

        // Convert divs to table if table view is enabled
        if (currentUserConfig.likesDisplay === "table") {
          const dataset = extractDatasetFromContainer(container);

          if (dataset.length > 0) {
            // Fetch affiliations for all accounts
            const affiliations = await Promise.all(
              dataset.map((item) =>
                item?.vkDomain
                  ? affiliationService.checkAccount(item.vkDomain)
                  : Promise.resolve(undefined),
              ),
            );

            // Find or create table
            let table = container.querySelector("table");
            let tbody: HTMLTableSectionElement;

            if (table === null) {
              // Create new table if it doesn't exist
              table = document.createElement("table");
              table.className = cn(
                `
                  bn:w-full bn:border-collapse
                  bn:text-(--vkui--color_text_primary)
                `,
              );
              tbody = document.createElement("tbody");
              table.append(tbody);
              container.append(table);
            } else {
              // Use existing tbody
              tbody =
                table.querySelector("tbody") ?? document.createElement("tbody");
              if (!table.contains(tbody)) {
                table.append(tbody);
              }
            }

            // Get current row count to continue indexing
            const currentRowCount = tbody.querySelectorAll("tr").length;

            // Append new rows for the new dataset items
            for (const [index, item] of dataset.entries()) {
              const row = createTableRow(
                currentRowCount + index,
                item,
                affiliations[index],
              );
              tbody.append(row);
            }

            // Remove the processed div elements from container
            const divsToRemove = [...container.children].filter(
              (el) => el instanceof HTMLElement && el.tagName !== "TABLE",
            );
            for (const div of divsToRemove) {
              div.remove();
            }
          }
        }

        const rows = [
          ...element.querySelectorAll<HTMLElement>(
            [
              ".fans_fan_row",
              'table > tbody > tr, [data-testid="grid-item"]', // New VK design
            ].join(", "),
          ),
        ];

        const loadCount = rows.length;

        shell.updateInfoText(
          `График показан только для загруженных аккаунтов. Подгрузка происходит, когда вы скроллите окно вниз. Соцсеть может скрывать некоторых лайкнувших. Загружено: ${loadCount} / ${totalCount} `,
        );

        if (loadCount >= totalCount) {
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

    const container = element.classList.contains("fans_rows")
      ? element
      : element.querySelector('[class*="vkitGrid__root"]'); // New VK design

    if (!container || !(container instanceof HTMLElement)) {
      logger.warn("likes-chart: container not found");
      shell.destroy();
      return;
    }

    await updateChartFromDom();

    const disconnect = observeFansRowsUpdates(container, updateChartFromDom);

    return () => {
      isDestroyed = true;
      disconnect();
      chart.destroy();
      shell.destroy();
    };
  },
});
