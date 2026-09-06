export default function StudioLoading() {
  return (
    <div className="flex flex-col h-full bg-white p-4 sm:p-6 gap-5 overflow-auto animate-in fade-in duration-200 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-black pb-4">
        <div>
          <div className="skeleton-pulse h-5 w-28 mb-2" />
          <div className="skeleton-pulse h-3 w-56" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton-pulse h-9 w-32 border border-black" />
          <div className="skeleton-pulse h-9 w-32 border border-black" />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton-pulse h-8 w-24 border border-zinc-200" />
        ))}
      </div>

      {/* Artifact cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="border border-black p-4 bg-white shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-2 mb-3">
              <div className="skeleton-pulse w-8 h-8 border border-black" />
              <div className="skeleton-pulse h-5 w-16" />
            </div>
            <div className="skeleton-pulse h-4 w-3/4 mb-2" />
            <div className="skeleton-pulse h-3 w-full mb-1" />
            <div className="skeleton-pulse h-3 w-2/3 mb-4" />
            <div className="flex justify-between items-center">
              <div className="skeleton-pulse h-3 w-20" />
              <div className="skeleton-pulse h-7 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
