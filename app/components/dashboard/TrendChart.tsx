"use client";

import { useEffect, useRef } from "react";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

import type { TrendPoint } from "../../lib/dashboard-view.js";
import { CHART_COLOR, DATA_COLOR } from "../../lib/theme.js";

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

/** 多期趋势折线：缺数据的期间断开；只有一期时显示单点 */
export function TrendChart({
  label,
  unit,
  points,
}: {
  label: string;
  unit: string;
  points: readonly TrendPoint[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const chart = echarts.init(container, undefined, { renderer: "canvas" });
    chart.setOption({
      animationDuration: 500,
      textStyle: { fontFamily: "inherit" },
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        trigger: "axis",
        backgroundColor: CHART_COLOR.tooltipBackground,
        borderWidth: 0,
        textStyle: { color: CHART_COLOR.tooltipText, fontSize: 13 },
        valueFormatter: (value: unknown) => (typeof value === "number" ? `${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })} ${unit}` : "无数据"),
      },
      xAxis: {
        type: "category",
        data: points.map((point) => point.label),
        axisLine: { lineStyle: { color: CHART_COLOR.axisLine } },
        axisLabel: { color: CHART_COLOR.categoryLabel, fontSize: 12 },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLabel: { color: CHART_COLOR.axisLabel, fontSize: 12 },
        splitLine: { lineStyle: { color: CHART_COLOR.gridLine, type: "dashed" } },
      },
      series: [
        {
          name: label,
          type: "line",
          data: points.map((point) => point.value),
          connectNulls: false,
          symbolSize: 8,
          lineStyle: { color: DATA_COLOR.total, width: 2 },
          itemStyle: { color: DATA_COLOR.total },
        },
      ],
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [label, unit, points]);

  return (
    <>
      <div ref={containerRef} role="img" aria-label={`${label}多期趋势`} className="h-48 w-full" />
      <table className="sr-only">
        <caption>{label}（{unit}）</caption>
        <tbody>
          {points.map((point) => (
            <tr key={point.period}>
              <th scope="row">{point.label}</th>
              <td>{point.value === null ? "无数据" : point.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
