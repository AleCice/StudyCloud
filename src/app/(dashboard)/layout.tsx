'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  FolderClosed, MessageSquare, GraduationCap, LayoutDashboard, 
  Layers, Settings2, LogOut, Presentation, Menu, X, ChevronRight
} from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [showMoreSheet, setShowMoreSheet] = useState(false)

  // Lista completa navigazione per desktop
  const desktopNavItems = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/files', label: 'File', icon: FolderClosed },
    { href: '/chat', label: 'Chat AI', icon: MessageSquare },
    { href: '/studio', label: 'Studio', icon: Presentation },
    { href: '/flashcards', label: 'Flashcard', icon: Layers },
    { href: '/tutor', label: 'Tutor', icon: GraduationCap },
    { href: '/settings', label: 'Impostazioni', icon: Settings2 },
  ]

  // 4 Tab principali per la Bottom Bar Mobile
  const mobilePrimaryTabs = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/files', label: 'File', icon: FolderClosed },
    { href: '/chat', label: 'Chat', icon: MessageSquare },
    { href: '/studio', label: 'Studio', icon: Presentation },
  ]

  // Voci per il cassetto "Altro" Bottom Sheet
  const mobileMoreItems = [
    { href: '/flashcards', label: 'Flashcard', icon: Layers, desc: 'Ripasso attivo & memorizzazione' },
    { href: '/tutor', label: 'Tutor AI', icon: GraduationCap, desc: 'Sessioni orali interattive' },
    { href: '/settings', label: 'Impostazioni', icon: Settings2, desc: 'Preferenze, API Key & Modelli' },
  ]

  // Rileva se la pagina attuale è una di quelle contenute in "Altro"
  const isMoreActive = mobileMoreItems.some(item => 
    pathname === item.href || pathname.startsWith(item.href + '/')
  )

  // Titolo della sezione attiva per l'header mobile
  const activeNavItem = desktopNavItems.find(item => 
    pathname === item.href || pathname.startsWith(item.href + '/')
  ) || { label: 'StudyCloud' }

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-white select-none">
      {/* 1. SIDEBAR DESKTOP (Visibile solo da schermo tablet/desktop md:flex) */}
      <aside className="hidden md:flex w-[var(--sidebar-width)] bg-white border-r border-black flex-col shrink-0 font-mono">
        {/* Logo & Brand */}
        <div className="h-[var(--header-height)] flex items-center justify-between px-4 border-b border-black">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="StudyCloud Logo" className="w-6 h-6 object-contain shrink-0" />
            <span className="font-bold text-[13px] text-black tracking-wider uppercase font-mono">StudyCloud</span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-1.5 overflow-y-auto">
          {desktopNavItems.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link 
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider transition-all border ${
                  isActive 
                    ? 'bg-black text-white border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]' 
                    : 'text-black border-transparent hover:bg-zinc-100 hover:border-black'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Desktop Bottom Logout */}
        <div className="p-3 border-t border-black">
          <form action="/api/auth/logout" method="POST">
            <button 
              type="submit"
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider text-black hover:bg-zinc-100 hover:border-black w-full transition-colors border border-transparent shadow-none hover:shadow-[2px_2px_0px_rgba(0,0,0,1)]"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Disconnetti</span>
            </button>
          </form>
        </div>
      </aside>

      {/* 2. MAIN CONTAINER (Desktop & Mobile) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-white">
        {/* MOBILE TOP BAR (Visibile solo su smartphone < md) */}
        <header 
          className="flex md:hidden bg-white border-b border-black items-center justify-between px-4 shrink-0 z-40"
          style={{ paddingTop: 'max(0.6rem, env(safe-area-inset-top))', paddingBottom: '0.6rem' }}
        >
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="StudyCloud Logo" className="w-6 h-6 object-contain shrink-0" />
            <div>
              <span className="font-bold text-xs text-black tracking-tight leading-none block uppercase font-mono">StudyCloud</span>
              <span className="text-[10px] text-zinc-500 font-mono font-medium">{activeNavItem.label}</span>
            </div>
          </div>

          <form action="/api/auth/logout" method="POST">
            <button 
              type="submit"
              className="p-1.5 text-zinc-600 hover:text-black hover:bg-zinc-100 transition-colors border border-black shadow-[1px_1px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
              title="Disconnetti"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </form>
        </header>

        {/* Pagina Principale (Viewport a tenuta stagna senza scroll globale) */}
        <main 
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col bg-white relative"
          style={{ paddingBottom: 'calc(3.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <style>{`@media (min-width: 768px) { main { padding-bottom: 0 !important; } }`}</style>
          {children}
        </main>

        {/* 3. MOBILE BOTTOM NAVIGATION BAR (4 Tab Spaziosi + Altro) */}
        <nav 
          className="flex md:hidden fixed bottom-0 inset-x-0 bg-white border-t-2 border-black z-40 select-none shadow-[0px_-2px_0px_rgba(0,0,0,0.06)]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="grid grid-cols-5 w-full items-center h-14">
            {/* 4 Tab Principali */}
            {mobilePrimaryTabs.map(item => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center h-full transition-colors relative active:bg-zinc-100 ${
                    isActive
                      ? 'text-black font-bold'
                      : 'text-zinc-500 hover:text-black'
                  }`}
                >
                  {isActive && (
                    <span className="absolute top-0 inset-x-2 h-0.5 bg-black" />
                  )}
                  <Icon className={`w-4 h-4 mb-1 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                  <span className="text-[10px] font-mono tracking-tight leading-none text-center">
                    {item.label}
                  </span>
                </Link>
              )
            })}

            {/* Tasto "Altro" che apre il Bottom Sheet */}
            <button
              type="button"
              onClick={() => setShowMoreSheet(true)}
              className={`flex flex-col items-center justify-center h-full transition-colors relative active:bg-zinc-100 ${
                isMoreActive ? 'text-black font-bold' : 'text-zinc-500 hover:text-black'
              }`}
            >
              {isMoreActive && (
                <span className="absolute top-0 inset-x-2 h-0.5 bg-black" />
              )}
              <Menu className={`w-4 h-4 mb-1 ${isMoreActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              <span className="text-[10px] font-mono tracking-tight leading-none text-center">
                Altro
              </span>
            </button>
          </div>
        </nav>

        {/* 4. BRUTALIST BOTTOM SHEET "ALTRO" */}
        {showMoreSheet && (
          <div 
            className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 animate-in fade-in duration-150"
            onClick={() => setShowMoreSheet(false)}
          >
            <div 
              className="bg-white border-t-2 border-black w-full max-h-[85vh] overflow-y-auto p-4 animate-in slide-in-from-bottom-6 duration-200 shadow-[0px_-6px_0px_rgba(0,0,0,1)]"
              style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header del cassetto */}
              <div className="flex items-center justify-between pb-3 border-b border-black mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-black inline-block" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-black">
                    Menu // Funzioni
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMoreSheet(false)}
                  className="p-1 border border-black text-black hover:bg-black hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Lista opzioni secondarie */}
              <div className="space-y-2 mb-4">
                {mobileMoreItems.map(item => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setShowMoreSheet(false)}
                      className={`flex items-center justify-between p-3 border transition-colors ${
                        isActive
                          ? 'bg-black text-white border-black font-bold'
                          : 'bg-zinc-50 border-zinc-300 text-black hover:bg-zinc-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 border ${isActive ? 'border-white bg-zinc-900' : 'border-black bg-white'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-mono font-bold uppercase tracking-tight">{item.label}</p>
                          <p className={`text-[10px] ${isActive ? 'text-zinc-300' : 'text-zinc-500'}`}>{item.desc}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-70" />
                    </Link>
                  )
                })}
              </div>

              {/* Tasto Logout all'interno del Bottom Sheet */}
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 p-2.5 border border-black bg-white text-black hover:bg-black hover:text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnetti Sessione</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
