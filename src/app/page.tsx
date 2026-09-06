import Link from 'next/link'
import Image from 'next/image'

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-black font-mono flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none">
      <div className="w-full max-w-md border-2 border-black p-8 sm:p-10 shadow-[6px_6px_0px_rgba(0,0,0,1)] bg-white text-left">
        {/* Header Badge */}
        <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-6">
          <div className="flex items-center gap-2.5">
            <Image 
              src="/logo.png" 
              alt="StudyCloud Logo" 
              width={28} 
              height={28} 
              className="object-contain"
            />
            <span className="font-bold text-sm tracking-wider uppercase">
              STUDYCLOUD
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 border border-black bg-zinc-50">
            v1.0 // B&W
          </span>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-tight text-black mb-3">
          Knowledge Base Universitaria
        </h1>
        <p className="text-xs text-zinc-600 mb-8 leading-relaxed font-mono">
          Spazio personale cloud-first con motore RAG per chat su dispense, docente virtuale e studio delle materie d&apos;esame.
        </p>

        <div className="flex flex-col gap-3">
          <Link 
            href="/dashboard"
            className="w-full py-2.5 px-4 bg-black text-white hover:bg-zinc-800 active:translate-x-[1px] active:translate-y-[1px] text-xs font-mono uppercase font-bold tracking-wider transition border-2 border-black text-center shadow-[2px_2px_0px_rgba(0,0,0,1)]"
          >
            Apri Dashboard
          </Link>
          <Link 
            href="/login"
            className="w-full py-2.5 px-4 bg-white text-black hover:bg-zinc-100 active:translate-x-[1px] active:translate-y-[1px] text-xs font-mono uppercase font-bold tracking-wider transition border-2 border-black text-center shadow-[2px_2px_0px_rgba(0,0,0,1)]"
          >
            Accedi / Registrati
          </Link>
        </div>

        <div className="mt-8 pt-4 border-t border-zinc-200 text-center">
          <p className="text-[10px] text-zinc-400 uppercase tracking-widest">
            Crittografia Locale AES-GCM // Supabase Guard
          </p>
        </div>
      </div>
    </main>
  )
}
