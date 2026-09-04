export default function TutorLoading() {
  return (
    <div className="flex flex-col h-full bg-white animate-in fade-in duration-200">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-zinc-200 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="skeleton-pulse h-5 w-24 mb-2" />
            <div className="skeleton-pulse h-3 w-48" />
          </div>
          <div className="skeleton-pulse h-9 w-36" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <div className="skeleton-pulse h-8 w-28" />
          <div className="skeleton-pulse h-8 w-28" />
        </div>
      </div>

      {/* Session list / content area */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border border-zinc-200 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="skeleton-pulse w-8 h-8" />
                <div className="flex-1">
                  <div className="skeleton-pulse h-4 w-3/4 mb-1" />
                  <div className="skeleton-pulse h-2 w-1/2" />
                </div>
              </div>
              <div className="skeleton-pulse h-3 w-full mb-1" />
              <div className="skeleton-pulse h-3 w-2/3 mb-3" />
              <div className="flex justify-between">
                <div className="skeleton-pulse h-6 w-20" />
                <div className="skeleton-pulse h-6 w-6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
