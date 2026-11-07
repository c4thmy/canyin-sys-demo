import * as echarts from "echarts";

import { formatAmount, formatSignedAmount } from "../format.js";
import type { ProfitBridgeNode } from "../metrics/types.js";
import { CHART_COLOR, DATA_COLOR } from "../theme.js";

/**
 * 报告配图：服务端用 ECharts SSR 渲染为 SVG 字符串，写入报告快照。
 * 好处：历史报告的图与数一起冻结；导出的 HTML 离线可看，无需客户端回传图片。
 */

function render(option: echarts.EChartsCoreOption, width = 880, height = 340): string {
  const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width, height });
  try {
    chart.setOption({ animation: false, textStyle: { fontFamily: "sans-serif" }, ...option });
    return chart.renderToSVGString();
  } finally {
    chart.dispose();
  }
}

const axisCommon = {
  axisLabel: { color: CHART_COLOR.axisLabel, fontSize: 12 },
  axisLine: { lineStyle: { color: CHART_COLOR.axisLine } },
  splitLine: { lineStyle: { color: CHART_COLOR.gridLine } },
};

/** 利润桥瀑布图（与总览页同一配色：上升绿 / 下降红 / 合计蓝） */
export function profitBridgeSvg(nodes: readonly ProfitBridgeNode[]): string {
  const isTotal = (node: ProfitBridgeNode) => node.kind === "start" || node.kind === "end";
  const bases = nodes.map((node, index) =>
    isTotal(node) ? Math.min(0, node.cumulative) : Math.min(nodes[index - 1].cumulative, node.cumulative),
  );
  const bars = nodes.map((node) => ({
    value: isTotal(node) ? Math.abs(node.cumulative) : Math.abs(node.effect),
    itemStyle: { color: isTotal(node) ? DATA_COLOR.total : node.effect >= 0 ? DATA_COLOR.up : DATA_COLOR.down },
    label: {
      show: true,
      position: "top" as const,
      color: CHART_COLOR.valueLabel,
      fontSize: 11,
      formatter: isTotal(node) ? formatAmount(node.cumulative) : formatSignedAmount(node.effect),
    },
  }));
  return render({
    grid: { left: 8, right: 8, top: 32, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: nodes.map((node) => node.label), ...axisCommon, axisLabel: { ...axisCommon.axisLabel, interval: 0, rotate: 30 } },
    yAxis: { type: "value", ...axisCommon },
    series: [
      { type: "bar", stack: "bridge", data: bases, itemStyle: { color: "transparent" }, silent: true },
      { type: "bar", stack: "bridge", data: bars, barMaxWidth: 36 },
    ],
  });
}

/** 横向条形图：正值绿、负值红，用于同比差额排行 */
export function deltaBarSvg(rows: readonly { label: string; value: number }[]): string {
  const ordered = [...rows].reverse();
  return render(
    {
      grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: "value", ...axisCommon },
      yAxis: { type: "category", data: ordered.map((row) => row.label), ...axisCommon },
      series: [
        {
          type: "bar",
          barMaxWidth: 18,
          data: ordered.map((row) => ({
            value: row.value,
            itemStyle: { color: row.value >= 0 ? DATA_COLOR.up : DATA_COLOR.down },
            label: { show: true, position: row.value >= 0 ? "right" : "left", fontSize: 11, color: CHART_COLOR.valueLabel, formatter: formatSignedAmount(row.value) },
          })),
        },
      ],
    },
    880,
    Math.max(160, ordered.length * 30 + 24),
  );
}
