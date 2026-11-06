"use client";

import { useEffect, useRef } from "react";
import { BarChart } from "echarts/charts";
import { AxisPointerComponent, GridComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import type { EChartsCoreOption } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

import { formatAmount, formatSignedAmount } from "../lib/format.js";
import type { ProfitBridgeNode } from "../lib/metrics/types.js";

echarts.use([BarChart, GridComponent, TooltipComponent, AxisPointerComponent, CanvasRenderer]);

const UP_COLOR = "#0f9d76";
const DOWN_COLOR = "#d64545";
const TOTAL_COLOR = "#2563eb";

function dataIndexOf(params: unknown): number {
  if (typeof params === "object" && params !== null && "dataIndex" in params) {
    const value = (params as { dataIndex?: unknown }).dataIndex;
    if (typeof value === "number") {
      return value;
    }
  }
  return 0;
}

function isTotal(node: ProfitBridgeNode): boolean {
  return node.kind === "start" || node.kind === "end";
}

function buildOption(nodes: readonly ProfitBridgeNode[], rotate: number): EChartsCoreOption {
  const bases = nodes.map((node, index) => {
    if (isTotal(node)) {
      return Math.min(0, node.cumulative);
    }
    return Math.min(nodes[index - 1].cumulative, node.cumulative);
  });

  const bars = nodes.map((node) => {
    const value = isTotal(node) ? Math.abs(node.cumulative) : Math.abs(node.effect);
    const color = isTotal(node) ? TOTAL_COLOR : node.effect >= 0 ? UP_COLOR : DOWN_COLOR;
    return { value, itemStyle: { color, borderRadius: [4, 4, 0, 0] as [number, number, number, number] } };
  });

  const labelOf = (index: number): string => {
    const node = nodes[index];
    return isTotal(node) ? formatAmount(node.cumulative) : formatSignedAmount(node.effect);
  };

  const tooltipFormatter = (params: unknown): string => {
    const list = Array.isArray(params) ? params : [params];
    const node = nodes[dataIndexOf(list[0])];
    if (!node) {
      return "";
    }
    const effect = isTotal(node) ? "—" : `${formatSignedAmount(node.effect)} 万元`;
    return [
      `<div style="font-weight:600;margin-bottom:4px">${node.label}</div>`,
      `<div>因素影响：${effect}</div>`,
      `<div>累计营业利润：${formatAmount(node.cumulative)} 万元</div>`,
    ].join("");
  };

  return {
    animationDuration: 650,
    textStyle: { fontFamily: "inherit" },
    grid: { left: 8, right: 8, top: 48, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow", shadowStyle: { color: "rgba(15, 23, 42, 0.04)" } },
      backgroundColor: "#0f172a",
      borderWidth: 0,
      padding: [10, 14],
      textStyle: { color: "#f8fafc", fontSize: 13 },
      formatter: tooltipFormatter,
    },
    xAxis: {
      type: "category",
      data: nodes.map((node) => node.label),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#cbd5e1" } },
      axisLabel: {
        interval: 0,
        rotate,
        color: "#334155",
        fontSize: 13,
        margin: 14,
      },
    },
    yAxis: {
      type: "value",
      name: "万元",
      nameGap: 18,
      nameTextStyle: { color: "#64748b", fontSize: 12 },
      axisLabel: { color: "#64748b", fontSize: 12 },
      splitLine: { lineStyle: { color: "#e9eff5", type: "dashed" } },
    },
    series: [
      {
        name: "占位",
        type: "bar",
        stack: "bridge",
        silent: true,
        barWidth: "46%",
        itemStyle: { color: "transparent" },
        emphasis: { itemStyle: { color: "transparent" } },
        data: bases,
      },
      {
        name: "因素贡献",
        type: "bar",
        stack: "bridge",
        barWidth: "46%",
        data: bars,
        label: {
          show: true,
          position: "top",
          distance: 6,
          color: "#0f172a",
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "SFMono-Regular, Menlo, Consolas, monospace",
          formatter: (params: unknown) => labelOf(dataIndexOf(params)),
        },
      },
    ],
  };
}

export function ProfitBridgeChart({ nodes }: { nodes: readonly ProfitBridgeNode[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const chart = echarts.init(container, undefined, { renderer: "canvas" });
    chart.setOption(buildOption(nodes, container.clientWidth < 860 ? 32 : 0));

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [nodes]);

  return (
    <>
      <div
        ref={containerRef}
        role="img"
        aria-label="利润桥瀑布图：从去年营业利润到今年营业利润，逐项展示收入规模与各成本因素的影响"
        className="h-[460px] w-full"
      />
      <table className="sr-only">
        <caption>利润桥明细（万元）</caption>
        <thead>
          <tr>
            <th scope="col">因素</th>
            <th scope="col">影响额</th>
            <th scope="col">累计营业利润</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => (
            <tr key={node.key}>
              <th scope="row">{node.label}</th>
              <td>{isTotal(node) ? "—" : formatSignedAmount(node.effect)}</td>
              <td>{formatAmount(node.cumulative)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
