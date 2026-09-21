function Bar({ className = "" }: { className?: string }) {
  return <div className={`shimmer rounded-lg ${className}`} />;
}

export default function Loading() {
  return (
    <div className="space-y-6 py-10" aria-busy="true" aria-label="Loading">
      <div className="glass rounded-2xl p-8 sm:p-12">
        <Bar className="h-9 w-2/3" />
        <Bar className="mt-4 h-4 w-1/2" />
        <div className="mt-8 flex gap-3">
          <Bar className="h-11 w-36" />
          <Bar className="h-11 w-36" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Bar className="h-56" />
        <Bar className="h-56" />
        <Bar className="h-56" />
      </div>
    </div>
  );
}
