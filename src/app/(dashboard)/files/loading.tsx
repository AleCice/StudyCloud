export default function FilesLoading() {
  return (
    <div className="flex flex-col h-full bg-white animate-in fade-in duration-200">
      {/* Toolbar skeleton */}
      <div className="min-h-12 border-b border-zinc-200 flex items-center px-4 py-2 gap-3 bg-[#fafafa] shrink-0">
        <div className="flex items-center gap-1 flex-1">
          <div className="skeleton-pulse h-4 w-24" />
          <div className="skeleton-pulse h-3 w-3 mx-1" />
          <div className="skeleton-pulse h-4 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <div className="skeleton-pulse h-8 w-32" />
          <div className="skeleton-pulse h-8 w-20" />
          <div className="skeleton-pulse h-8 w-20" />
        </div>
      </div>

      {/* Table header skeleton */}
      <div className="border-b border-zinc-200 bg-[#fafafa] px-6 py-2 flex items-center gap-8">
        <div className="skeleton-pulse h-3 w-16" />
        <div className="skeleton-pulse h-3 w-28" />
        <div className="skeleton-pulse h-3 w-12" />
        <div className="skeleton-pulse h-3 w-20" />
        <div className="skeleton-pulse h-3 w-16" />
      </div>

      {/* Table rows skeleton */}
      <div className="flex-1 overflow-auto">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-6 py-3 border-b border-zinc-50">
            <div className="skeleton-pulse w-5 h-5 shrink-0" />
            <div className="skeleton-pulse h-3 flex-1 max-w-xs" style={{ width: `${60 + Math.random() * 30}%` }} />
            <div className="skeleton-pulse h-3 w-24" />
            <div className="skeleton-pulse h-3 w-16" />
            <div className="skeleton-pulse h-3 w-16" />
            <div className="skeleton-pulse h-5 w-20" />
          </div>
        ))}
      </div>

      {/* Status bar skeleton */}
      <div className="h-7 border-t border-zinc-200 bg-[#fafafa] px-4 flex items-center shrink-0">
        <div className="skeleton-pulse h-2.5 w-24" />
      </div>
    </div>
  )
}
