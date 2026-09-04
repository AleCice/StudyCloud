'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  FolderClosed, MessageSquare, GraduationCap, LayoutDashboard, 
  Layers, Settings2, LogOut, Presentation 
} from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const navItems = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/files', label: 'File', icon: FolderClosed },
    { href: '/chat', label: 'Chat AI', icon: MessageSquare },
    { href: '/tutor', label: 'Tutor', icon: GraduationCap },
    { href: '/studio', label: 'Studio', icon: Presentation },
    { href: '/flashcards', label: 'Flashcard', icon: Layers },
    { href: '/settings', label: 'Impostazioni', icon: Settings2 },
  ]

  // Rileva il titolo della sezione attiva per l'header mobile
  const activeNavItem = navItems.find(item => 
    pathname === item.href || pathname.startsWith(item.href + '/')
  ) || { label: 'StudyCloud' }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      {/* 1. SIDEBAR DESKTOP (Visibile solo da schermo tablet/desktop md:flex) */}
      <aside className="hidden md:flex w-[var(--sidebar-width)] bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex-col shrink-0">
        {/* Logo & Brand */}
        <div className="h-[var(--header-height)] flex items-center justify-between px-5 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-black text-white flex items-center justify-center font-bold text-xs tracking-wider">
              S
            </div>
            <span className="font-bold text-[14px] text-black tracking-tight uppercase">StudyCloud</span>
          </div>
          <span className="text-[10px] bg-black text-white px-1.5 py-0.5 font-mono font-bold tracking-widest">
            PRO
          </span>
        </div>

        {/* Desktop Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-1">
          {navItems.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link 
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 text-[13px] font-medium transition-colors border ${
                  isActive 
                    ? 'bg-black text-white border-black font-semibold' 
                    : 'text-zinc-600 border-transparent hover:bg-zinc-100 hover:text-black hover:border-zinc-300'
                }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Desktop Bottom Logout */}
        <div className="p-3 border-t border-[var(--color-border)]">
          <form action="/api/auth/logout" method="POST">
            <button 
              type="submit"
              className="flex items-center gap-3 px-3 py-2 text-[13px] font-medium text-zinc-500 hover:text-black hover:bg-zinc-100 w-full transition-colors border border-transparent hover:border-zinc-200"
            >
              <LogOut className="w-[18px] h-[18px] shrink-0" />
              <span>Disconnetti</span>
            </button>
          </form>
        </div>
      </aside>

      {/* 2. MAIN CONTAINER (Desktop & Mobile) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* MOBILE TOP BAR (Visibile solo su smartphone < md) */}
        <header className="flex md:hidden h-14 bg-white border-b border-zinc-200 items-center justify-between px-4 shrink-0 z-40">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-black text-white flex items-center justify-center font-bold text-xs">
              S
            </div>
            <div>
              <span className="font-bold text-sm text-black tracking-tight leading-none block uppercase">StudyCloud</span>
              <span className="text-[10px] text-zinc-500 font-mono">{activeNavItem.label}</span>
            </div>
          </div>

          <form action="/api/auth/logout" method="POST">
            <button 
              type="submit"
              className="p-2 text-zinc-600 hover:text-black hover:bg-zinc-100 transition-colors border border-zinc-200"
              title="Disconnetti"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </header>

        {/* Pagina Principale */}
        <main className="flex-1 overflow-hidden flex flex-col bg-white pb-16 md:pb-0 relative">
          {children}
        </main>

        {/* 3. MOBILE BOTTOM NAVIGATION BAR */}
        <nav className="flex md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-zinc-200 z-50 px-1 py-1 shadow-xs">
          <div className="grid grid-cols-6 w-full items-center">
            {navItems.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center py-1 px-0.5 transition-colors min-h-[48px] border-t-2 ${
                    isActive
                      ? 'text-black font-bold border-black bg-zinc-50'
                      : 'text-zinc-500 hover:text-black border-transparent'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                  <span className="text-[9px] tracking-tight leading-none text-center truncate max-w-full">
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
