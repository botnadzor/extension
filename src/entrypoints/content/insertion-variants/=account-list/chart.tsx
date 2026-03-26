import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleBand, scaleLinear } from "@visx/scale";
import { Bar } from "@visx/shape";

import { formatInt } from "@/shared/formatting";

import type { DerivedAccountChart } from "./aggregation";

const chartMargin = {
  bottom: 48,
  left: 42,
  right: 12,
  top: 18,
};
const minimumChartHeight = 100;

export function AccountListChart({
  chart,
  height,
  hoveredMillion,
  onHoveredMillionChange,
  width,
}: {
  chart: DerivedAccountChart;
  height: number;
  hoveredMillion: number | undefined;
  onHoveredMillionChange: (million: number | undefined) => void;
  width: number;
}) {
  if (chart.buckets.length === 0 || height < minimumChartHeight || width <= 0) {
    return;
  }

  const chartHeight = height;
  const yRangeStart = Math.max(
    chartMargin.top + 1,
    chartHeight - chartMargin.bottom,
  );
  const gridWidth = Math.max(0, width - chartMargin.left - chartMargin.right);
  const interactiveBarHeight = Math.max(
    1,
    chartHeight - chartMargin.top - chartMargin.bottom,
  );
  const yMaxValue = Math.max(
    ...chart.buckets.map((bucket) =>
      bucket.counts.reduce((sum, value) => sum + value, 0),
    ),
  );

  const xScale = scaleBand<number>({
    domain: chart.buckets.map((bucket) => bucket.million),
    padding: 0.24,
    range: [chartMargin.left, width - chartMargin.right],
  });

  const yScale = scaleLinear<number>({
    domain: [0, Math.max(4, Math.ceil(yMaxValue))],
    range: [yRangeStart, chartMargin.top],
    nice: true,
  });

  return (
    <svg
      aria-label="График распределения аккаунтов"
      className="
        absolute inset-0 block size-full
        **:font-ubuntu
      "
      height={chartHeight}
      viewBox={`0 0 ${width} ${chartHeight}`}
      width={width}
      fontFamily="var(--font-ubuntu)"
    >
      <Group>
        <GridRows
          className="*:stroke-border"
          height={chartHeight}
          left={chartMargin.left}
          numTicks={Math.min(5, Math.max(2, Math.ceil(yMaxValue)))}
          scale={yScale}
          width={gridWidth}
        />

        {chart.buckets.map((bucket) => {
          const x = xScale(bucket.million);
          if (x === undefined) {
            return;
          }

          const barWidth = xScale.bandwidth();
          const padding = xScale.padding() * barWidth;
          let stackedValue = 0;

          return (
            <g key={bucket.million}>
              <Bar
                className="fill-transparent"
                height={interactiveBarHeight}
                onMouseEnter={() => {
                  onHoveredMillionChange(bucket.million);
                }}
                onMouseLeave={() => {
                  onHoveredMillionChange(undefined);
                }}
                width={barWidth + padding + 2}
                x={x - padding / 2 - 1}
                y={chartMargin.top}
              />

              {hoveredMillion === bucket.million && (
                <Bar
                  className="pointer-events-none fill-border/50"
                  height={interactiveBarHeight}
                  width={barWidth + padding}
                  x={x - padding / 2}
                  y={chartMargin.top}
                />
              )}

              {bucket.counts.map((count, index) => {
                const category = chart.categories[index];
                if (!category || count === 0) {
                  stackedValue += count;
                  return;
                }

                const previousStackValue = stackedValue;
                stackedValue += count;

                return (
                  <Bar
                    key={category.id}
                    fill={category.color}
                    height={yScale(previousStackValue) - yScale(stackedValue)}
                    width={barWidth}
                    x={x}
                    className="pointer-events-none"
                    y={yScale(stackedValue)}
                  />
                );
              })}
            </g>
          );
        })}
      </Group>

      <AxisLeft
        axisClassName="[&_.visx-line]:stroke-border"
        hideAxisLine={true}
        label="Число аккаунтов"
        labelClassName="fill-foreground!"
        labelOffset={32}
        labelProps={{ fontSize: 12 }}
        left={chartMargin.left}
        numTicks={Math.max(
          2,
          Math.min(
            5,
            Math.floor(
              (chartHeight - chartMargin.top - chartMargin.bottom) / 44,
            ),
            Math.ceil(yMaxValue),
          ),
        )}
        scale={yScale}
        stroke="currentColor"
        tickFormat={(value) => formatInt(Math.round(value.valueOf()))}
        tickLength={2}
        tickLabelProps={() => ({
          className: "fill-muted-foreground",
          dx: -4,
          dy: "0.33em",
          fontSize: 12,
          textAnchor: "end",
        })}
        tickStroke="currentColor"
      />

      <AxisBottom
        axisClassName="[&_.visx-line]:stroke-border"
        label="Диапазон айди аккаунтов (миллионы)"
        labelClassName="fill-foreground!"
        labelOffset={10}
        labelProps={{
          fontSize: 12,
        }}
        scale={xScale}
        stroke="currentColor"
        tickFormat={(value) => formatInt(value)}
        tickLabelProps={() => ({
          className: "fill-muted-foreground",
          fontSize: 12,
          textAnchor: "middle",
        })}
        tickLength={2}
        tickStroke="currentColor"
        top={chartHeight - chartMargin.bottom}
      />
    </svg>
  );
}
