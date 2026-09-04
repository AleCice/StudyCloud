export default function SettingsLoading() {
  return (
    <div className="flex flex-col h-full bg-white animate-in fade-in duration-200">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-zinc-200 shrink-0">
        <div className="skeleton-pulse h-5 w-32 mb-2" />
        <div className="skeleton-pulse h-3 w-56" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Tab sidebar */}
        <div className="hidden sm:flex w-48 border-r border-zinc-200 flex-col p-3 gap-1 shrink-0">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-2 p-2">
              <div className="skeleton-pulse w-4 h-4" />
              <div className="skeleton-pulse h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Settings content */}
        <div className="flex-1 p-4 sm:p-6 overflow-auto space-y-6">
          {/* Section */}
          <div>
            <div className="skeleton-pulse h-4 w-32 mb-4" />
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i}>
                  <div className="skeleton-pulse h-3 w-24 mb-2" />
                  <div className="skeleton-pulse h-10 w-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-4 border-t border-zinc-200">
            <div className="skeleton-pulse h-10 w-32" />
            <div className="skeleton-pulse h-10 w-28" />
          </div>
        </div>
      </div>
    </div>
  )
}
