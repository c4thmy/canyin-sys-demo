/** 新店徽标；与正负增长色区分，使用品牌青绿 */
export function NewBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-micro font-semibold leading-4 text-teal-700 ${className}`}
    >
      新
    </span>
  );
}
