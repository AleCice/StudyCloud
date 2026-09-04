import { login, signup } from './actions'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { message?: string }
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-white text-black font-sans">
      <div className="w-full max-w-md bg-white p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        
        {/* Badge Piattaforma Privata */}
        <div className="flex items-center justify-between mb-6 pb-3 border-b-2 border-black">
          <span className="text-[11px] font-mono uppercase font-bold tracking-widest bg-black text-white px-2 py-0.5">
            STUDYCLOUD // v1.0
          </span>
          <span className="text-[10px] font-mono uppercase font-semibold text-zinc-600">
            SOLO SU INVITO
          </span>
        </div>

        <h1 className="text-2xl font-bold font-mono uppercase tracking-tight text-black mb-2">
          Accesso Riservato
        </h1>
        <p className="text-xs text-zinc-600 mb-6 font-mono leading-relaxed">
          Questa applicazione è personale e privata. Per accedere inserisci le tue credenziali; per registrarti è richiesto un codice d&apos;invito valido.
        </p>

        <form className="space-y-4 flex flex-col w-full">
          <div>
            <label className="block text-xs font-mono uppercase font-bold text-black mb-1.5" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="w-full px-3 py-2.5 bg-white border-2 border-black text-black text-sm font-mono placeholder:text-zinc-400 focus:outline-none focus:bg-zinc-50 transition"
              name="email"
              type="email"
              placeholder="nome@universita.it"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase font-bold text-black mb-1.5" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="w-full px-3 py-2.5 bg-white border-2 border-black text-black text-sm font-mono placeholder:text-zinc-400 focus:outline-none focus:bg-zinc-50 transition"
              type="password"
              name="password"
              placeholder="••••••••••••"
              required
            />
          </div>

          {/* Campo Codice Invito per Nuove Registrazioni */}
          <div className="pt-1 border-t border-dashed border-zinc-300 mt-2">
            <label className="block text-xs font-mono uppercase font-bold text-zinc-700 mb-1" htmlFor="inviteCode">
              Codice Invito <span className="text-[10px] font-normal text-zinc-500 lowercase">(solo per registrazioni)</span>
            </label>
            <input
              id="inviteCode"
              className="w-full px-3 py-2 bg-zinc-50 border-2 border-zinc-400 text-black text-xs font-mono placeholder:text-zinc-400 focus:outline-none focus:border-black transition"
              type="text"
              name="inviteCode"
              placeholder="ES: STUDYCLOUD_VIP_2026"
            />
          </div>

          <div className="pt-3 flex flex-col gap-2.5">
            <button 
              formAction={login}
              className="w-full py-2.5 px-4 bg-black text-white hover:bg-zinc-800 active:translate-x-[1px] active:translate-y-[1px] text-xs font-mono uppercase font-bold tracking-wider transition border-2 border-black"
            >
              Accedi
            </button>
            <button 
              formAction={signup}
              className="w-full py-2 px-4 bg-white text-black hover:bg-zinc-100 active:translate-x-[1px] active:translate-y-[1px] text-xs font-mono uppercase font-semibold tracking-wider transition border-2 border-black"
            >
              Registrati con Invito
            </button>
          </div>

          {searchParams?.message && (
            <div className="mt-4 p-3 bg-zinc-100 border-2 border-black text-black text-xs font-mono leading-relaxed">
              <span className="font-bold text-red-600 mr-1.5">[AVVISO]</span>
              {searchParams.message}
            </div>
          )}
        </form>

        <div className="mt-6 pt-4 border-t border-zinc-200 text-center">
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
            Autenticazione Crittografata // Supabase Auth Guard
          </p>
        </div>

      </div>
    </div>
  )
}
