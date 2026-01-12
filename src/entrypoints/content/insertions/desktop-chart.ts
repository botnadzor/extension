import { affiliationService } from "@/lib/proxy-services";

import type { Insertion } from "../insertion-basics";
import { createChartShell, observeFansRowsUpdates } from "./shared/chart-shell";
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

  init: async ({ element, logger }) => {
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
      `График показан только для загруженных аккаунтов. Подгрузка происходит, когда вы скроллите окно вниз. Загружено: 0 / ${totalCount} `,
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
          `График показан только для загруженных аккаунтов. Подгрузка происходит, когда вы скроллите окно вниз. Загружено: ${loadCount} / ${totalCount} `,
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

    await updateChartFromDom();

    const disconnect = observeFansRowsUpdates(element, updateChartFromDom);

    return () => {
      isDestroyed = true;
      disconnect();
      chart.destroy();
      shell.destroy();
    };
  },
};

export default insertion;
