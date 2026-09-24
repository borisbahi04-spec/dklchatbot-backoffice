import { clsx } from "clsx";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning";
}) {
  const toneClasses: Record<string, string> = {
    neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200",
    danger: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone]
      )}
    >
      {children}
    </span>
  );
}
