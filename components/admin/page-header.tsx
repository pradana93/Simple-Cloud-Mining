import { cn } from "@/lib/utils";

// One title block for every admin page. Sits inside each page's header panel so
// controls (filters, actions) can stay on the right without re-styling the title.
export function AdminPageHeader({
  title,
  description,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <h1 className="font-display text-xl font-bold text-white">{title}</h1>
      {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
    </div>
  );
}
