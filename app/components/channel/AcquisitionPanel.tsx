import { formatAmount, formatInteger, formatPercent, formatSignedAmount, formatSignedPercent } from "../../lib/format.js";
import type { AcquisitionRow, AcquisitionStatus } from "../../lib/metrics/types.js";
import { TYPE } from "../../lib/theme.js";
import { MetricInfo } from "../MetricInfo.js";
import { Panel } from "../Panel.js";

const STATUS_LABEL: Record<AcquisitionStatus, string> = {
  met: "达标",
  tight: "刚好达标",
  short: "未达标",
};

const STATUS_STYLE: Record<
  AcquisitionStatus,
  { badge: string; bar: string; card: string; line: string }
> = {
  met: {
    badge: "border-up/30 bg-up-soft text-up",
    bar: "bg-up",
    card: "border-slate-200",
    line: "bg-slate-700",
  },
  tight: {
    badge: "border-amber-300 bg-amber-50 text-amber-800",
    bar: "bg-amber-400",
    card: "border-amber-300",
    line: "bg-slate-800",
  },
  short: {
    badge: "border-down/30 bg-down-soft text-down",
    bar: "bg-down",
    card: "border-down/30",
    line: "bg-slate-700",
  },
};

function Chip({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-micro text-slate-500">{label}</p>
      <p className={`mt-0.5 whitespace-nowrap ${TYPE.numberSm} leading-tight text-slate-900`}>
        {value}
        <span className="ml-1 text-xs font-normal text-slate-500">{unit}</span>
      </p>
    </div>
  );
}

function ratioText(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

function targetText(value: number): string {
  return value.toFixed(1);
}

/** 把浮点噪声（如 4.4e-16）归零，避免出现「+0.00」「+0.0%」这类读数 */
function tidy(value: number | null, digits: number): number | null {
  if (value === null) {
    return null;
  }
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return rounded === 0 ? 0 : rounded;
}

function AcquisitionCard({ row, unit }: { row: AcquisitionRow; unit: string }) {
  const tone = STATUS_STYLE[row.status];
  const targetGap = tidy(row.targetGap, 2);
  const targetGapRate = tidy(row.targetGapRate, 3);
  const ratio = row.outputRatio ?? 0;
  // 量表上限留 15% 余量，保证「刚好达标」的条形末端能与目标线重合，又不会顶到右边框
  const scale = Math.max(ratio, row.targetRoi) * 1.15;
  const barWidth = scale === 0 ? 0 : (ratio / scale) * 100;
  const targetLeft = scale === 0 ? 0 : (row.targetRoi / scale) * 100;

  return (
    <article className={`rounded-xl border p-4 lg:p-5 ${tone.card}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={TYPE.cardTitle}>{row.channel}</h3>
          <p className="mt-1 text-sm text-slate-500">
            目标 ROI <span className="font-mono tabular-nums">{targetText(row.targetRoi)}</span>
            <span className="mx-2 text-slate-300">·</span>
            新客 {formatInteger(row.newCustomers)} 人
          </p>
        </div>
        <span className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${tone.badge}`}>
          {STATUS_LABEL[row.status]}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Chip label="新客量" value={formatInteger(row.newCustomers)} unit="人" />
        <Chip label="客单价" value={formatAmount(row.ticket)} unit="元" />
        <Chip label="毛利率" value={formatPercent(row.grossMarginRate, 1)} unit="" />
        <Chip label="新客成本" value={formatAmount(row.newCustomerCost)} unit="元/人" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
          <p className="text-micro text-slate-500">毛利额</p>
          <p className="mt-0.5 font-mono text-lg font-semibold leading-tight text-slate-900 tabular-nums">
            {formatAmount(row.grossProfit)}
            <span className="ml-1 text-xs font-normal text-slate-500">{unit}</span>
          </p>
          <p className="mt-0.5 font-mono text-micro tabular-nums text-slate-400">
            收入 {formatAmount(row.revenue)} × {formatPercent(row.grossMarginRate, 0)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
          <p className="text-micro text-slate-500">投入成本</p>
          <p className="mt-0.5 font-mono text-lg font-semibold leading-tight text-slate-900 tabular-nums">
            {formatAmount(row.spend)}
            <span className="ml-1 text-xs font-normal text-slate-500">{unit}</span>
          </p>
          <p className="mt-0.5 font-mono text-micro tabular-nums text-slate-400">
            {formatInteger(row.newCustomers)} 人 × {formatAmount(row.newCustomerCost)} 元
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
            产投比 <span className="text-slate-400">= 毛利额 ÷ 投入成本</span>
            <MetricInfo metric="outputRatio" />
          </span>
          <span className="flex items-baseline gap-2">
            <span className={`${TYPE.numberMd} text-slate-900`}>{ratioText(row.outputRatio)}</span>
            <span className="text-sm text-slate-400">/ 目标 {targetText(row.targetRoi)}</span>
          </span>
        </div>

        <div className="relative mt-1 pt-5">
          <span
            className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-nano font-medium text-slate-500"
            style={{ left: `${targetLeft}%` }}
          >
            目标线 {targetText(row.targetRoi)}
          </span>
          <div
            role="img"
            aria-label={`${row.channel}产投比 ${ratioText(row.outputRatio)}，目标线 ${targetText(
              row.targetRoi,
            )}`}
            className="relative h-9 overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            <div className={`absolute inset-y-1 left-0 rounded-r-md ${tone.bar}`} style={{ width: `${barWidth}%` }} />
            <div
              className={`absolute inset-y-0 w-[2px] ${tone.line}`}
              style={{ left: `calc(${targetLeft}% - 1px)` }}
            />
          </div>
          <div className="mt-1 flex justify-between font-mono text-micro tabular-nums text-slate-400">
            <span>0</span>
            <span>量表上限 {scale.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
          <span className="text-slate-500">
            距目标（ROI）{' '}
            <span className="font-mono tabular-nums text-slate-800">
              {targetGap === null ? "—" : formatSignedAmount(targetGap)}
            </span>
          </span>
          <span className="text-slate-500">
            余量率{' '}
            <span className="font-mono tabular-nums text-slate-800">
              {formatSignedPercent(targetGapRate, 1)}
            </span>
          </span>
        </div>
      </div>
    </article>
  );
}

/**
 * 增收提价面板：每条渠道一行链路
 * 新客量 → 客单价 → 毛利额 → 投入成本 → 产投比 vs 目标 ROI。
 *
 * 「刚好达标」单独用琥珀色 + 实线目标线标出：条形末端与目标线重合，说明投放没有安全垫。
 */
export function AcquisitionPanel({
  rows,
  unit,
}: {
  rows: readonly AcquisitionRow[];
  unit: string;
}) {
  const tightCount = rows.filter((row) => row.status === "tight").length;

  return (
    <Panel
      title="增收提价 · 新客获取健康度"
      description="每个渠道一条链路：新客量 → 客单价 → 毛利额 → 投入成本 → 产投比 vs 目标 ROI。数据来自表8，是预算与目标，不是当期实际值。"
      actions={
        <span className={`rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 ${TYPE.note}`}>
          <span className="font-mono tabular-nums">{rows.length}</span> 个渠道 · 刚好达标{" "}
          <span className="font-mono tabular-nums">{tightCount}</span> 个
        </span>
      }
    >
      <div className="grid gap-4 xl:grid-cols-2">
        {rows.map((row) => (
          <AcquisitionCard key={row.channel} row={row} unit={unit} />
        ))}
      </div>

      <div className={`mt-5 space-y-2 ${TYPE.note}`}>
        <p>
          口径：产投比 = 毛利额 ÷ 投入成本 = （新客量 × 客单价 × 毛利率）÷（新客量 × 新客成本）=
          客单价 × 毛利率 ÷ 新客成本，即每投入 1 元获客成本换回多少元毛利；与投放规模无关，放大规模不会改变产投比。
        </p>
        <p>
          达标判定：产投比 ≥ 目标 ROI 视为达标；余量率 ≤ 5% 记为「刚好达标」（琥珀色），
          表示目标线就压在条形末端，投放只是及格线，没有再投的空间。
        </p>
      </div>
    </Panel>
  );
}
