import { formatSignedAmount } from "../lib/format.js";

/** 带正负色的等宽数字；text 由调用方传入以便带单位 */
export function DeltaValue({
  value,
  text,
  className = "",
}: {
  value: number;
  text?: string;
  className?: string;
}) {
  const tone = value > 0 ? "text-up" : value < 0 ? "text-down" : "text-slate-500";
  return (
    <span className={`font-mono tabular-nums ${tone} ${className}`}>
      {text ?? formatSignedAmount(value)}
    </span>
  );
}
