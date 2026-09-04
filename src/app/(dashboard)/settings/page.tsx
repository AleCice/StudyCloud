'use client'

import React, { useState, useEffect } from 'react'
import { 
  getSettingsData, updateProfileSettings, updateBudgetSettings, 
  updateAiSettings, exportAllUserData 
} from './actions'
import { reindexAllMissingEmbeddingsAction } from '@/app/(dashboard)/files/actions'
import { 
  Settings2, User, Cpu, DollarSign, Database, Shield, 
  Save, Download, Loader2, Check, AlertCircle, HardDrive, Key, ExternalLink, Activity, Zap, Sparkles, RefreshCw
} from 'lucide-react'
import { loadEncryptedApiKeys, saveEncryptedApiKeys, getSelectedGeminiModel, setSelectedGeminiModel } from '@/lib/crypto/storage'
import { GEMINI_MODELS } from '@/lib/ai/models'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'ai' | 'budget' | 'data' | 'security'>('profile')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Profile Form
  const [fullName, setFullName] = useState('')
  const [university, setUniversity] = useState('')
  const [degreeCourse, setDegreeCourse] = useState('')
  const [academicYear, setAcademicYear] = useState('')

  // Budget Form
  const [monthlyBudget, setMonthlyBudget] = useState(5.0)

  // AI Form (Crittografata in LocalStorage con AES-GCM)
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [selectedGeminiModel, setSelectedGeminiModelState] = useState('gemini-3.5-flash-lite')

  // Export
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    const [res, encKeys] = await Promise.all([
      getSettingsData(),
      loadEncryptedApiKeys()
    ])

    if (encKeys.geminiApiKey) setGeminiApiKey(encKeys.geminiApiKey)
    setSelectedGeminiModelState(getSelectedGeminiModel())

    if (res) {
      setData(res)
      setFullName(res.profile.full_name || '')
      setUniversity(res.profile.preferences?.university || '')
      setDegreeCourse(res.profile.preferences?.degree_course || '')
      setAcademicYear(res.profile.preferences?.academic_year || '2024/2025')
      setMonthlyBudget(Number(res.profile.preferences?.monthly_budget) || 5.0)
    }
    setLoading(false)
  }

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfileSettings({ fullName, university, degreeCourse, academicYear })
      showSuccess("Profilo aggiornato con successo!")
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateBudgetSettings(monthlyBudget)
      showSuccess("Limite di budget aggiornato!")
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAi = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      // 1. Salva nel Local Storage in formato cifrato AES-GCM
      await saveEncryptedApiKeys({ geminiApiKey })
      
      // 2. Salva il modello Gemini selezionato
      setSelectedGeminiModel(selectedGeminiModel)

      // 3. Salva preferenze utente
      await updateAiSettings({})
      showSuccess("Chiave API Google Gemini cifrata e modello preferito salvati con successo!")
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleExportData = async () => {
    setExporting(true)
    try {
      const exportData = await exportAllUserData()
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `studycloud_backup_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showSuccess("Backup scaricato con successo!")
    } catch (err: any) {
      alert("Errore esportazione dati: " + err.message)
    } finally {
      setExporting(false)
    }
  }

  const [reindexingVectors, setReindexingVectors] = useState(false)
  const handleReindexAllVectors = async () => {
    if (!geminiApiKey.trim()) {
      alert("Inserisci e salva prima la tua API Key di Google Gemini.")
      return
    }
    setReindexingVectors(true)
    try {
      const res = await reindexAllMissingEmbeddingsAction(geminiApiKey.trim(), selectedGeminiModel, true)
      if (res.processedDocs === 0 && res.totalDocs === 0) {
        showSuccess("Nessun documento o video trovato da indicizzare.")
      } else if (res.processedDocs === 0 && res.errors && res.errors.length > 0) {
        alert(`Errore rigenerazione: ${res.errors.map(e => `${e.title}: ${e.error}`).join('\n')}`)
      } else {
        showSuccess(`Rigenerati con successo ${res.totalChunks} vettori per ${res.processedDocs} documenti/video!`)
      }
      await loadSettings()
    } catch (err: any) {
      alert("Errore rigenerazione vettori: " + err.message)
    } finally {
      setReindexingVectors(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          Caricamento impostazioni...
        </div>
      </div>
    )
  }

  const currentSpend = data?.aiAnalytics?.totalSpendMonth || 0
  const budgetPercentage = Math.min(100, Math.round((currentSpend / monthlyBudget) * 100))

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white select-none">
      {/* Top Header */}
      <div className="h-[var(--header-height)] border-b border-[var(--color-border)] flex items-center justify-between px-6 shrink-0 bg-white">
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-[var(--color-accent)]" />
          <h1 className="text-[15px] font-semibold text-[var(--color-text)]">Impostazioni & Hardening</h1>
        </div>

        {/* Global Notifications */}
        {successMsg && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            {successMsg}
          </div>
        )}
      </div>

      {/* Main Grid: Responsive flex-col su mobile, flex-row su desktop */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-w-0">
        {/* Settings Navigation Tabs: orizzontale a scorrimento su mobile, verticale su desktop */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[var(--color-border)] bg-slate-50/70 p-2 md:p-3 flex md:flex-col overflow-x-auto md:overflow-x-visible gap-1.5 shrink-0 z-10">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'profile' ? 'bg-white text-blue-600 font-bold shadow-xs border border-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4 text-blue-600" />
            <span>Profilo & Studio</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'ai' ? 'bg-white text-blue-600 font-bold shadow-xs border border-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-4 h-4 text-purple-600" />
            <span>Modelli & AI</span>
          </button>

          <button
            onClick={() => setActiveTab('budget')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'budget' ? 'bg-white text-blue-600 font-bold shadow-xs border border-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span>Budget & Costi</span>
          </button>

          <button
            onClick={() => setActiveTab('data')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'data' ? 'bg-white text-blue-600 font-bold shadow-xs border border-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Database className="w-4 h-4 text-amber-600" />
            <span>Dati & Backup</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'security' ? 'bg-white text-blue-600 font-bold shadow-xs border border-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Shield className="w-4 h-4 text-indigo-600" />
            <span>Sicurezza & Audit</span>
          </button>
        </div>

        {/* Right Settings Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-3xl w-full min-w-0">
          {/* Tab 1: Profile */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">Profilo Universitario</h2>
                <p className="text-xs text-slate-500 mt-0.5">Gestisci i dettagli della tua carriera accademica</p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nome Completo</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500"
                    placeholder="Es. Mario Rossi"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email Account</label>
                  <input
                    type="text"
                    disabled
                    value={data?.user?.email || ''}
                    className="w-full border border-slate-200 bg-slate-50 text-slate-500 rounded-lg px-3 py-2 text-xs cursor-not-allowed"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Università / Ateneo</label>
                    <input
                      type="text"
                      value={university}
                      onChange={e => setUniversity(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500"
                      placeholder="Es. Politecnico di Torino"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Corso di Laurea</label>
                    <input
                      type="text"
                      value={degreeCourse}
                      onChange={e => setDegreeCourse(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500"
                      placeholder="Es. Ingegneria Informatica"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Anno Accademico</label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={e => setAcademicYear(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500"
                    placeholder="2024/2025"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salva Modifiche Profilo
              </button>
            </form>
          )}

          {/* Tab 2: AI & Modelli */}
          {activeTab === 'ai' && (
            <form onSubmit={handleSaveAi} className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">Configurazione Modelli AI & Chiavi Personali</h2>
                <p className="text-xs text-slate-500 mt-0.5">Scegli il modello Google Gemini da utilizzare e gestisci le tue chiavi API</p>
              </div>

              <div className="space-y-5 text-xs">
                {/* Security & BYOK Info Banner */}
                <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-sm space-y-2 border border-slate-800">
                  <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span>Politica Chiavi API: Crittografia Locale AES-GCM 256-bit</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    StudyCloud funziona esclusivamente tramite la tua <strong>chiave API personale</strong> (Bring Your Own Key). Non sono presenti chiavi condivise o preimpostate nel sistema. La tua chiave viene salvata cifrata nel tuo browser e inviata in modo sicuro alle API di Google.
                  </p>
                </div>

                {/* Gemini API Key Input */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  !geminiApiKey.trim() ? 'bg-amber-50/60 border-amber-300' : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-blue-600" />
                      Chiave API Google Gemini
                      {!geminiApiKey.trim() && (
                        <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                          Richiesta
                        </span>
                      )}
                    </label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                    >
                      Ottieni chiave gratuita su Google AI Studio
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <input
                    type="password"
                    placeholder="Incolla qui la tua chiave API (es. AIzaSy...)"
                    value={geminiApiKey}
                    onChange={e => setGeminiApiKey(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-xs bg-white text-slate-900 outline-none focus:border-blue-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-2">
                    {geminiApiKey.trim() 
                      ? "✓ Chiave personale configurata e protetta con crittografia client-side."
                      : "⚠️ Inserisci la tua chiave per poter utilizzare la Chat, il Tutor, le Flashcard e l'ingestione Video."}
                  </p>
                </div>

                {/* Gemini Model Selector Grid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 text-xs block">Seleziona il Modello Google Gemini</span>
                      <span className="text-[11px] text-slate-500">Scegli la variante di Gemini più adatta alle tue esigenze di studio</span>
                    </div>
                    <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg font-bold">
                      Attivo: {selectedGeminiModel}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {GEMINI_MODELS.map((model) => {
                      const isSelected = selectedGeminiModel === model.id
                      return (
                        <div
                          key={model.id}
                          onClick={() => setSelectedGeminiModelState(model.id)}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                            isSelected
                              ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 text-xs">{model.name}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                  model.category === 'frontier' 
                                    ? 'bg-indigo-100 text-indigo-800' 
                                    : model.category === 'reasoning'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {model.badge}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{model.id}</span>
                            </div>

                            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 border border-slate-300 transition-colors">
                              {isSelected ? (
                                <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                              ) : (
                                <div className="w-2.5 h-2.5 rounded-full bg-transparent" />
                              )}
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-600 leading-snug">
                            {model.description}
                          </p>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                            <span className="flex items-center gap-1 font-medium">
                              <Zap className="w-3 h-3 text-amber-500" />
                              Velocità: {model.speed === 'ultra' ? 'Ultra-Rapida' : model.speed === 'fast' ? 'Veloce' : 'Approfondita'}
                            </span>
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                              Contesto: {model.contextWindow}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50 active:scale-95"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salva Configurazioni AI & Modelli
              </button>
            </form>
          )}

          {/* Tab 3: Budget & Costi */}
          {activeTab === 'budget' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">Budget & Controllo Costi AI</h2>
                <p className="text-xs text-slate-500 mt-0.5">Monitora in tempo reale i consumi stimati e imposta un tetto mensile</p>
              </div>

              {/* Progress Card */}
              <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 font-medium">Spesa Mese Corrente</span>
                    <p className="text-2xl font-bold mt-0.5">${currentSpend.toFixed(4)} USD</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 font-medium">Budget Mensile</span>
                    <p className="text-2xl font-bold mt-0.5">${monthlyBudget.toFixed(2)} USD</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        budgetPercentage > 85 ? 'bg-red-500' : budgetPercentage > 60 ? 'bg-amber-400' : 'bg-emerald-400'
                      }`} 
                      style={{ width: `${Math.max(2, budgetPercentage)}%` }} 
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>{budgetPercentage}% utilizzato</span>
                    <span>Guardrail attivo a ${monthlyBudget.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Budget Form */}
              <form onSubmit={handleSaveBudget} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <label className="font-bold text-xs text-slate-800 block">
                  Modifica Tetto Massimale Mensile ($ USD)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="100"
                    value={monthlyBudget}
                    onChange={e => setMonthlyBudget(Number(e.target.value))}
                    className="w-36 border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white outline-none focus:border-blue-500 font-bold"
                  />
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    Aggiorna Budget
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Se la spesa mensile supera questo importo, le operazioni AI non essenziali verranno temporaneamente sospese per proteggerti da costi imprevisti.
                </p>
              </form>

              {/* Feature breakdown */}
              <div>
                <h3 className="font-bold text-xs text-slate-900 mb-3 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-blue-600" />
                  Ripartizione Utilizzo per Funzionalità
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(data?.aiAnalytics?.featureBreakdown || {}).map(([feat, val]: any) => (
                    <div key={feat} className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">{feat}</span>
                      <p className="text-sm font-semibold text-slate-900 mt-1">${(val.cost || 0).toFixed(4)}</p>
                      <p className="text-[10px] text-slate-500">{val.calls || 0} chiamate • {val.tokens || 0} tok</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Dati & Backup */}
          {activeTab === 'data' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">Dati, Knowledge Base & Backup</h2>
                <p className="text-xs text-slate-500 mt-0.5">Gestisci l&apos;esportazione dei tuoi materiali e lo spazio occupato</p>
              </div>

              {/* Stats cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-600 mb-1">
                    <Database className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-xs">Documenti Archiviati</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{data?.totalDocs || 0}</p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-600 mb-1">
                    <HardDrive className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-xs">Spazio Storage Cloud</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{data?.totalStorageMB || 0} MB</p>
                </div>
              </div>

              {/* Re-indexing Vectors Card */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Sincronizza & Rigenera Vettori pgvector (RAG)</h3>
                    <p className="text-[11px] text-slate-500">Rigenera i vettori semantici per tutti i video YouTube e documenti caricati</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Se hai importato video YouTube o documenti prima di configurare la tua API Key, questa funzione estrae le trascrizioni/testi e calcola gli embeddings <code>gemini-embedding-2 (768D)</code> salvandoli nel database vettoriale per abilitare la ricerca semantica nella Chat e nel Tutor.
                </p>
                <button
                  onClick={handleReindexAllVectors}
                  disabled={reindexingVectors}
                  className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
                >
                  {reindexingVectors ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> : <RefreshCw className="w-4 h-4" />}
                  {reindexingVectors ? 'Rigenerazione in corso...' : 'Rigenera Tutti i Vettori RAG'}
                </button>
              </div>

              {/* Export Button */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3">
                <h3 className="font-bold text-sm text-slate-900">Esporta Backup Completo</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Scarica in un unico file JSON strutturato tutti i tuoi corsi, metadati dei documenti, sessioni di chat, domande del tutor e flashcard.
                </p>
                <button
                  onClick={handleExportData}
                  disabled={exporting}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
                >
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Scarica Backup JSON
                </button>
              </div>
            </div>
          )}

          {/* Tab 5: Sicurezza & Audit */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">Sicurezza & Audit Log</h2>
                <p className="text-xs text-slate-500 mt-0.5">Tracciamento delle operazioni sensibili e stato dell&apos;account</p>
              </div>

              {/* Audit Log Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                <div className="p-3.5 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800">
                  Ultimi 20 Eventi di Audit
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {(data?.recentAuditLogs || []).length === 0 ? (
                    <p className="p-4 text-slate-400 italic text-center">Nessun evento di audit registrato</p>
                  ) : (
                    (data.recentAuditLogs as any[]).map(log => (
                      <div key={log.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div>
                          <span className="font-semibold text-slate-900">{log.action}</span>
                          <span className="text-slate-400 text-[11px] ml-2">({log.entity_type})</span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {new Date(log.created_at).toLocaleString('it-IT')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
