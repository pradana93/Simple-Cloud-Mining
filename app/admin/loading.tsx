// Loading state for every admin page: the shell stays, the figures fill in.
export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-6 w-48 animate-pulse rounded-md bg-white/5" />
        <div className="h-3 w-72 animate-pulse rounded-md bg-white/5" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel h-44 animate-pulse rounded-2xl lg:col-span-2" />
        <div className="panel h-44 animate-pulse rounded-2xl" />
      </div>
      <div className="panel h-64 animate-pulse rounded-2xl" />
      <div className="panel h-48 animate-pulse rounded-2xl" />
    </div>
  );
}
