export default function DashboardLoading() {
  return (
    <div className="flex flex-col h-full bg-white p-4 sm:p-6 gap-6 overflow-auto animate-in fade-in duration-200">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="skeleton-pulse h-6 w-48 mb-2" />
          <div className="skeleton-pulse h-3 w-72" />
        </div>
        <div className="skeleton-pulse h-9 w-28" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="border border-zinc-200 p-4">
            <div className="skeleton-pulse h-3 w-20 mb-3" />
            <div className="skeleton-pulse h-7 w-16 mb-1" />
            <div className="skeleton-pulse h-2 w-24" />
          </div>
        ))}
      </div>

      {/* 3D Vector Space placeholder */}
      <div className="border border-zinc-200 p-4 flex-1 min-h-[200px]">
        <div className="skeleton-pulse h-4 w-40 mb-4" />
        <div className="skeleton-pulse w-full h-full min-h-[160px]" />
      </div>

      {/* Recent docs */}
      <div>
        <div className="skeleton-pulse h-4 w-36 mb-3" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 border border-zinc-100">
              <div className="skeleton-pulse w-5 h-5 shrink-0" />
              <div className="flex-1">
                <div className="skeleton-pulse h-3 w-3/4 mb-1.5" />
                <div className="skeleton-pulse h-2 w-1/3" />
              </div>
              <div className="skeleton-pulse h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
