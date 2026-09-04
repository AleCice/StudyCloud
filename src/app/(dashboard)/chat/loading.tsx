export default function ChatLoading() {
  return (
    <div className="flex h-full bg-white animate-in fade-in duration-200">
      {/* Sidebar sessions */}
      <div className="hidden md:flex w-72 border-r border-zinc-200 flex-col bg-[#fafafa] shrink-0">
        <div className="p-3 border-b border-zinc-200">
          <div className="skeleton-pulse h-9 w-full" />
        </div>
        <div className="flex-1 p-2 space-y-1.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-3 flex items-center gap-2">
              <div className="skeleton-pulse w-4 h-4 shrink-0" />
              <div className="flex-1">
                <div className="skeleton-pulse h-3 w-full mb-1" />
                <div className="skeleton-pulse h-2 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Chat header */}
        <div className="h-12 border-b border-zinc-200 flex items-center px-4 gap-3 shrink-0">
          <div className="skeleton-pulse h-4 w-48" />
        </div>

        {/* Messages area */}
        <div className="flex-1 p-4 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-md ${i % 2 === 0 ? 'w-2/5' : 'w-3/5'}`}>
                <div className="skeleton-pulse h-3 w-full mb-1.5" />
                <div className="skeleton-pulse h-3 w-4/5 mb-1.5" />
                {i % 2 !== 0 && <div className="skeleton-pulse h-3 w-3/5" />}
              </div>
            </div>
          ))}
        </div>

        {/* Input area */}
        <div className="p-4 border-t border-zinc-200 shrink-0">
          <div className="skeleton-pulse h-12 w-full" />
        </div>
      </div>
    </div>
  )
}
