export default function FlashcardsLoading() {
  return (
    <div className="flex flex-col h-full bg-white animate-in fade-in duration-200 font-mono">
      {/* Header area */}
      <div className="p-4 sm:p-6 border-b border-black shrink-0 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="skeleton-pulse h-5 w-32 mb-2" />
            <div className="skeleton-pulse h-3 w-52" />
          </div>
          <div className="flex gap-2">
            <div className="skeleton-pulse h-9 w-28" />
            <div className="skeleton-pulse h-9 w-28" />
          </div>
        </div>
        {/* Filter / context bar */}
        <div className="flex items-center gap-3">
          <div className="skeleton-pulse h-8 w-40" />
          <div className="skeleton-pulse h-8 w-32" />
          <div className="skeleton-pulse h-8 w-24" />
        </div>
      </div>

      {/* Flashcard study area */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-lg">
          {/* Card */}
          <div className="border-2 border-black p-8 min-h-[280px] flex flex-col items-center justify-center shadow-[4px_4px_0px_rgba(0,0,0,1)] bg-white">
            <div className="skeleton-pulse h-4 w-3/4 mb-3" />
            <div className="skeleton-pulse h-4 w-1/2 mb-2" />
            <div className="skeleton-pulse h-3 w-2/3 mb-6" />
            <div className="skeleton-pulse h-8 w-32" />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mt-4">
            <div className="skeleton-pulse h-10 w-10 border border-black" />
            <div className="skeleton-pulse h-3 w-20" />
            <div className="skeleton-pulse h-10 w-10 border border-black" />
          </div>
        </div>
      </div>
    </div>
  )
}
