import { formatAmount, formatSignedPercent } from "../lib/format.js";
import type { StoreDetailView } from "../lib/store-view.js";
import { describeTicketGap, describeTrafficGrowthGap } from "../lib/store-view.js";
import { Panel } from "./Panel.js";

function TicketRows({ benchmark }: { benchmark: StoreDetailView["benchmark"] }) {
  const average = benchmark.averageTicket;
  if (average === null) {
    return <p className="text-sm text-slate-500">暂无同店平均客单价</p>;
  }
  const scale = Math.max(benchmark.storeTicket, average) * 1.06;
  const rows = [
    { key: "store", label: "本店", value: benchmark.storeTicket, fill: "bg-teal-500" },
    { key: "average", label: "同店平均", value: average, fill: "bg-slate-400" },
  ];
  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.key}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-slate-500">{row.label}</span>
            <span className="font-mono tabular-nums text-slate-800">{formatAmount(row.value)} 元</span>
          </div>
          <div className="mt-1 h-3.5 overflow-hidden rounded-sm bg-slate-100" aria-hidden="true">
            <div className={`h-full rounded-sm ${row.fill}`} style={{ width: `${(row.value / scale) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function GrowthRows({ benchmark }: { benchmark: StoreDetailView["benchmark"] }) {
  const average = benchmark.trafficGrowthRate;
  const store = benchmark.storeTrafficGrowth;
  if (average === null || store === null) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm leading-6 text-slate-500">
        新店无上年同期，无法计算客流增速。
      </p>
    );
  }
  const scale = Math.max(Math.abs(store), Math.abs(average), 0.001) * 1.15;
  const rows = [
    { key: "store", label: "本店", value: store, fill: "bg-teal-500" },
    { key: "average", label: "同店平均", value: average, fill: "bg-slate-400" },
  ];
  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const width = Math.max(1.5, (Math.abs(row.value) / scale) * 50);
        const positive = row.value >= 0;
        return (
          <div key={row.key}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-slate-500">{row.label}</span>
              <span className="font-mono tabular-nums text-slate-800">{formatSignedPercent(row.value)}</span>
            </div>
            <div className="relative mt-1 h-3.5 overflow-hidden rounded-sm bg-slate-100" aria-hidden="true">
              <span className="absolute inset-y-0 left-1/2 w-px bg-slate-300" />
              <div
                className={`absolute inset-y-0 rounded-sm ${row.fill}`}
                style={
                  positive
                    ? { left: "50%", width: `${Math.min(50, width)}%` }
                    : { right: "50%", width: `${Math.min(50, width)}%` }
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PeerComparisonPanel({ view }: { view: StoreDetailView }) {
  const { benchmark } = view;

  return (
    <Panel
      title="同店横向对比"
      description={
        view.store.isNew
          ? "新店只与同店平均客单价对比；客流增速与收入排名需要上年同期或同店身份。"
          : "把本店放回 13 家同店里看：客单价、客流增速与收入排名。"
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="peer-ticket-title">
          <h3 id="peer-ticket-title" className="text-sm font-semibold text-slate-800">
            客单价 vs 同店平均
          </h3>
          <div className="mt-3">
            <TicketRows benchmark={benchmark} />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{describeTicketGap(benchmark)}</p>
          <p className="mt-1 text-xs text-slate-400">同店平均 = 13 家同店按客流加权，本期。</p>
        </section>

        <section aria-labelledby="peer-growth-title">
          <h3 id="peer-growth-title" className="text-sm font-semibold text-slate-800">
            客流增速 vs 同店平均
          </h3>
          <div className="mt-3">
            <GrowthRows benchmark={benchmark} />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{describeTrafficGrowthGap(benchmark)}</p>
          <p className="mt-1 text-xs text-slate-400">增速 = 本期客流 ÷ 上年同期客流 − 1。</p>
        </section>

        <section aria-labelledby="peer-rank-title">
          <h3 id="peer-rank-title" className="text-sm font-semibold text-slate-800">
            同店收入排名
          </h3>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-5">
            {benchmark.revenueRank === null ? (
              <p className="font-mono text-3xl font-semibold text-slate-400">—</p>
            ) : (
              <p className="font-mono text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
                第 {benchmark.revenueRank}
                <span className="ml-1 text-lg font-normal text-slate-500">/ {benchmark.sameStoreCount} 名</span>
              </p>
            )}
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {benchmark.revenueRank === null
                ? "新店不参与同店收入排名"
                : `按本期收入降序，同店共 ${benchmark.sameStoreCount} 家`}
            </p>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-400">
            按本期收入降序；排名只看 13 家同店，新店不参与。13 家同店本期收入合计{' '}
            {formatAmount(view.summary.revenueCurrent)} 万元，同店平均客单价{' '}
            {benchmark.averageTicket === null ? "—" : `${formatAmount(benchmark.averageTicket)} 元`}。
          </p>
        </section>
      </div>
    </Panel>
  );
}
