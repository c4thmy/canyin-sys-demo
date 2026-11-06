import { METRIC_DEFINITIONS, metricTooltip, type MetricKey } from "../lib/theme.js";

/**
 * 指标口径说明：一个可聚焦的小圆点，hover / 键盘聚焦时显示公式与数据来源。
 *
 * 同时挂原生 `title`（兼容不支持 CSS hover 的场景），所有页面共用这一份实现，
 * 不要在页面里手写口径文案。
 */
export function MetricInfo({
  metric,
  className = "",
}: {
  metric: MetricKey;
  className?: string;
}) {
  const definition = METRIC_DEFINITIONS[metric];

  return (
    <span
      tabIndex={0}
      role="note"
      title={metricTooltip(metric)}
      aria-label={`${definition.label}口径：${definition.formula}。数据来源：${definition.source}`}
      className={`group relative inline-flex h-[18px] w-[18px] shrink-0 cursor-help items-center justify-center rounded-full border border-slate-300 bg-white align-middle text-micro font-semibold leading-none text-slate-500 transition hover:border-teal-400 hover:text-teal-700 focus-visible:border-teal-400 focus-visible:text-teal-700 ${className}`}
    >
      <span aria-hidden="true">i</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 hidden w-72 max-w-[70vw] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left text-xs font-normal leading-5 text-slate-600 shadow-lg group-hover:block group-focus-visible:block"
      >
        <span className="block text-sm font-semibold text-slate-900">{definition.label}</span>
        <span className="mt-1 block font-mono text-micro leading-5 text-slate-700">
          {definition.formula}
        </span>
        <span className="mt-1 block text-slate-500">来源：{definition.source}</span>
      </span>
    </span>
  );
}
