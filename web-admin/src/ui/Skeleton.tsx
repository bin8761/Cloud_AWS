import type { HTMLAttributes } from "react";

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  lines?: number;
  circle?: boolean;
};

export function Skeleton({
  lines = 1,
  circle = false,
  className = "",
  ...props
}: SkeletonProps): JSX.Element {
  const isMultiLine = lines > 1 && !circle;

  if (isMultiLine) {
    return (
      <div className={["space-y-2", className].join(" ")} {...props}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={`skeleton-line-${index}`}
            className={[
              "h-4 animate-pulse rounded-[var(--radius-xs)] bg-slate-200",
              index === lines - 1 ? "w-3/4" : "w-full",
            ].join(" ")}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={[
        "animate-pulse bg-slate-200",
        circle ? "h-10 w-10 rounded-full" : "h-4 w-full rounded-[var(--radius-xs)]",
        className,
      ].join(" ")}
      aria-hidden="true"
      {...props}
    />
  );
}

