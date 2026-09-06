'use client'

import React, { useState, useEffect } from 'react'
import { 
  getSettingsData, updateProfileSettings, updateBudgetSettings, 
  updateAiSettings, exportAllUserData 
} from './actions'
import { reindexAllMissingEmbeddingsAction } from '@/app/(dashboard)/files/actions'
import { 
  Settings2, User, Cpu, DollarSign, Database, Shield, 
  Save, Download, Loader2, Check, HardDrive, Key, ExternalLink, Activity, Zap, Sparkles, RefreshCw
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

  // Forms Dirty & Saved Tracking
  const [profileDirty, setProfileDirty] = useState(false)
  const [aiDirty, setAiDirty] = useState(false)
  const [budgetDirty, setBudgetDirty] = useState(false)

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
      setProfileDirty(false)
      setAiDirty(false)
      setBudgetDirty(false)
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
      setProfileDirty(false)
      showSuccess("Profilo aggiornato e salvato nel cloud!")
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
      setBudgetDirty(false)
      showSuccess("Limite di budget aggiornato e salvato nel cloud!")
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
      setAiDirty(false)
      showSuccess("Chiave API Google Gemini salvata e sincronizzata con successo!")
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
      <div className="flex-1 flex items-center justify-center bg-white font-mono text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-black" />
          <span>CARICAMENTO IMPOSTAZIONI...</span>
        </div>
      </div>
    )
  }

  const currentSpend = data?.aiAnalytics?.totalSpendMonth || 0
  const budgetPercentage = Math.min(100, Math.round((currentSpend / monthlyBudget) * 100))

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white select-none text-black font-sans">
      {/* Top Header */}
      <div className="h-[var(--header-height)] border-b border-black flex items-center justify-between px-4 sm:px-6 shrink-0 bg-white font-mono text-xs">
        <div className="flex items-center gap-2">
          <div className="border border-black p-1 bg-white text-black">
            <Settings2 className="w-4 h-4" />
          </div>
          <h1 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-black">
            Impostazioni // Sistema & AI
          </h1>
        </div>

        {/* Global Notifications */}
        {successMsg && (
          <div className="flex items-center gap-1.5 text-xs text-white bg-black border border-black px-3 py-1 font-mono font-bold uppercase shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            <Check className="w-3.5 h-3.5 text-white" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-1.5 text-xs text-white bg-black border border-black px-3 py-1 font-mono font-bold uppercase shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            <span>[ERRORE] {errorMsg}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Responsive flex-col su mobile, flex-row su desktop */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-w-0">
        {/* Settings Navigation Tabs */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-black bg-zinc-50 p-2 md:p-3 flex md:flex-col overflow-x-auto md:overflow-x-visible gap-1.5 shrink-0 z-10 font-mono text-xs">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap shrink-0 transition-colors border ${
              activeTab === 'profile' 
                ? 'bg-black text-white border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]' 
                : 'bg-white text-black border-zinc-200 hover:border-black hover:bg-zinc-100'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profilo & Studio</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap shrink-0 transition-colors border ${
              activeTab === 'ai' 
                ? 'bg-black text-white border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]' 
                : 'bg-white text-black border-zinc-200 hover:border-black hover:bg-zinc-100'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Modelli & AI</span>
          </button>

          <button
            onClick={() => setActiveTab('budget')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap shrink-0 transition-colors border ${
              activeTab === 'budget' 
                ? 'bg-black text-white border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]' 
                : 'bg-white text-black border-zinc-200 hover:border-black hover:bg-zinc-100'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Budget & Costi</span>
          </button>

          <button
            onClick={() => setActiveTab('data')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap shrink-0 transition-colors border ${
              activeTab === 'data' 
                ? 'bg-black text-white border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]' 
                : 'bg-white text-black border-zinc-200 hover:border-black hover:bg-zinc-100'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Dati & Backup</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap shrink-0 transition-colors border ${
              activeTab === 'security' 
                ? 'bg-black text-white border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]' 
                : 'bg-white text-black border-zinc-200 hover:border-black hover:bg-zinc-100'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Sicurezza & Audit</span>
          </button>
        </div>

        {/* Right Settings Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-3xl w-full min-w-0 font-mono">
          {/* Tab 1: Profile */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="border-b border-black pb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-black">Profilo Accademico</h2>
                <p className="text-xs text-zinc-500 mt-1 font-sans">Gestisci i dettagli della tua carriera universitaria</p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-bold uppercase tracking-wider text-black block mb-1">Nome Completo</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => {
                      setFullName(e.target.value)
                      setProfileDirty(true)
                    }}
                    className="w-full border border-black bg-white px-3 py-2 text-xs outline-none focus:bg-zinc-50 text-black font-sans"
                    placeholder="Es. Mario Rossi"
                  />
                </div>

                <div>
                  <label className="font-bold uppercase tracking-wider text-black block mb-1">Email Account</label>
                  <input
                    type="text"
                    disabled
                    value={data?.user?.email || ''}
                    className="w-full border border-zinc-300 bg-zinc-100 text-zinc-500 px-3 py-2 text-xs cursor-not-allowed font-sans"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold uppercase tracking-wider text-black block mb-1">Università / Ateneo</label>
                    <input
                      type="text"
                      value={university}
                      onChange={e => {
                        setUniversity(e.target.value)
                        setProfileDirty(true)
                      }}
                      className="w-full border border-black bg-white px-3 py-2 text-xs outline-none focus:bg-zinc-50 text-black font-sans"
                      placeholder="Es. Politecnico di Torino"
                    />
                  </div>

                  <div>
                    <label className="font-bold uppercase tracking-wider text-black block mb-1">Corso di Laurea</label>
                    <input
                      type="text"
                      value={degreeCourse}
                      onChange={e => {
                        setDegreeCourse(e.target.value)
                        setProfileDirty(true)
                      }}
                      className="w-full border border-black bg-white px-3 py-2 text-xs outline-none focus:bg-zinc-50 text-black font-sans"
                      placeholder="Es. Ingegneria Informatica"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold uppercase tracking-wider text-black block mb-1">Anno Accademico</label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={e => {
                      setAcademicYear(e.target.value)
                      setProfileDirty(true)
                    }}
                    className="w-full border border-black bg-white px-3 py-2 text-xs outline-none focus:bg-zinc-50 text-black font-sans"
                    placeholder="2024/2025"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || !profileDirty}
                className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider border border-black transition-colors ${
                  saving
                    ? 'bg-black text-white opacity-70 cursor-wait'
                    : profileDirty
                    ? 'bg-black hover:bg-zinc-800 text-white shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]'
                    : 'bg-zinc-100 text-black cursor-default'
                }`}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvataggio...</span>
                  </>
                ) : profileDirty ? (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Salva</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Salvato</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Tab 2: AI & Modelli */}
          {activeTab === 'ai' && (
            <form onSubmit={handleSaveAi} className="space-y-6">
              <div className="border-b border-black pb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-black">Configurazione Modelli AI & Chiavi Personali</h2>
                <p className="text-xs text-zinc-500 mt-1 font-sans">Scegli il modello Google Gemini da utilizzare e gestisci le tue chiavi API</p>
              </div>

              <div className="space-y-5 text-xs">
                {/* Gemini API Key Input */}
                <div className={`p-4 border-2 border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)] space-y-2`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-black" />
                      Chiave API Google Gemini
                      {!geminiApiKey.trim() && (
                        <span className="text-[10px] bg-black text-white px-2 py-0.5 font-bold uppercase">
                          Richiesta
                        </span>
                      )}
                    </label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-black hover:underline flex items-center gap-1 font-bold uppercase"
                    >
                      Ottieni chiave gratuita su Google AI Studio
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <input
                    type="password"
                    placeholder="Incolla qui la tua chiave API (es. AIzaSy...)"
                    value={geminiApiKey}
                    onChange={e => {
                      setGeminiApiKey(e.target.value)
                      setAiDirty(true)
                    }}
                    className="w-full border border-black px-3 py-2 text-xs bg-white text-black outline-none focus:bg-zinc-50 font-mono"
                  />
                  <p className="text-[11px] text-zinc-500 font-sans">
                    {geminiApiKey.trim() 
                      ? "✓ Chiave personale configurata e protetta con crittografia client-side AES-GCM."
                      : "⚠️ Inserisci la tua chiave per poter utilizzare la Chat, il Tutor, le Flashcard e l'ingestione Video."}
                  </p>
                </div>

                {/* Gemini Model Selector Grid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold uppercase tracking-wider text-black text-xs block">Seleziona Modello Google Gemini</span>
                      <span className="text-[11px] text-zinc-500 font-sans">Scegli la variante di Gemini per la generazione e studio</span>
                    </div>
                    <span className="text-[11px] bg-black text-white border border-black px-2 py-0.5 font-bold uppercase">
                      Attivo: {selectedGeminiModel}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {GEMINI_MODELS.map((model) => {
                      const isSelected = selectedGeminiModel === model.id
                      return (
                        <div
                          key={model.id}
                          onClick={() => {
                            setSelectedGeminiModelState(model.id)
                            setAiDirty(true)
                          }}
                          className={`p-3.5 border cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                            isSelected
                              ? 'border-2 border-black bg-zinc-100 shadow-[3px_3px_0px_rgba(0,0,0,1)]'
                              : 'border border-zinc-300 hover:border-black bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-black text-xs uppercase">{model.name}</span>
                                <span className={`text-[9px] px-1.5 py-0.5 border font-mono uppercase font-bold ${
                                  isSelected ? 'border-black bg-black text-white' : 'border-zinc-300 bg-white text-zinc-700'
                                }`}>
                                  {model.badge}
                                </span>
                              </div>
                              <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">{model.id}</span>
                            </div>

                            <div className="w-4 h-4 border border-black flex items-center justify-center shrink-0">
                              {isSelected ? (
                                <div className="w-2.5 h-2.5 bg-black" />
                              ) : null}
                            </div>
                          </div>

                          <p className="text-[11px] text-zinc-600 leading-snug font-sans">
                            {model.description}
                          </p>

                          <div className="flex items-center justify-between pt-2 border-t border-zinc-200 text-[10px] text-zinc-500 font-mono">
                            <span className="flex items-center gap-1 font-bold uppercase">
                              <Zap className="w-3 h-3 text-black" />
                              Velocità: {model.speed === 'ultra' ? 'Ultra' : model.speed === 'fast' ? 'Fast' : 'Deep'}
                            </span>
                            <span className="border border-zinc-300 px-1 py-0.5 bg-white text-black font-bold">
                              {model.contextWindow}
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
                disabled={saving || !aiDirty}
                className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider border border-black transition-colors ${
                  saving
                    ? 'bg-black text-white opacity-70 cursor-wait'
                    : aiDirty
                    ? 'bg-black hover:bg-zinc-800 text-white shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]'
                    : 'bg-zinc-100 text-black cursor-default'
                }`}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvataggio...</span>
                  </>
                ) : aiDirty ? (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Salva</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Salvato</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Tab 3: Budget & Costi */}
          {activeTab === 'budget' && (
            <div className="space-y-6">
              <div className="border-b border-black pb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-black">Budget & Controllo Costi AI</h2>
                <p className="text-xs text-zinc-500 mt-1 font-sans">Monitora in tempo reale i consumi stimati e imposta un tetto mensile</p>
              </div>

              {/* Progress Card Brutalist */}
              <div className="p-5 bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase font-bold text-zinc-500">Spesa Mese Corrente</span>
                    <p className="text-2xl font-bold mt-0.5 text-black">${currentSpend.toFixed(4)} USD</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs uppercase font-bold text-zinc-500">Tetto Mensile</span>
                    <p className="text-2xl font-bold mt-0.5 text-black">${monthlyBudget.toFixed(2)} USD</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="w-full h-3 border border-black bg-zinc-100 p-[1px]">
                    <div 
                      className="h-full bg-black transition-all duration-300"
                      style={{ width: `${Math.max(2, budgetPercentage)}%` }} 
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500 uppercase font-bold">
                    <span>{budgetPercentage}% utilizzato</span>
                    <span>Guardrail attivo a ${monthlyBudget.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Budget Form */}
              <form onSubmit={handleSaveBudget} className="p-4 bg-zinc-50 border border-black space-y-3">
                <label className="font-bold text-xs uppercase tracking-wider text-black block">
                  Modifica Tetto Massimale Mensile ($ USD)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="100"
                    value={monthlyBudget}
                    onChange={e => {
                      setMonthlyBudget(Number(e.target.value))
                      setBudgetDirty(true)
                    }}
                    className="w-36 border border-black px-3 py-2 text-xs bg-white outline-none focus:bg-zinc-100 font-bold font-mono"
                  />
                  <button
                    type="submit"
                    disabled={saving || !budgetDirty}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border border-black transition-colors ${
                      saving
                        ? 'bg-black text-white opacity-70 cursor-wait'
                        : budgetDirty
                        ? 'bg-black hover:bg-zinc-800 text-white shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px]'
                        : 'bg-zinc-100 text-black cursor-default'
                    }`}
                  >
                    {saving ? 'Salvataggio...' : budgetDirty ? 'Salva' : '✓ Salvato'}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 font-sans">
                  Se la spesa mensile stimata supera questo importo, le operazioni AI non essenziali verranno temporaneamente sospese per prevenire costi indesiderati.
                </p>
              </form>

              {/* Feature breakdown */}
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-black mb-3 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-black" />
                  Ripartizione Utilizzo per Funzionalità
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {Object.entries(data?.aiAnalytics?.featureBreakdown || {}).map(([feat, val]: any) => (
                    <div key={feat} className="p-3 bg-white border border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                      <span className="text-[10px] font-bold text-black uppercase tracking-wider">{feat}</span>
                      <p className="text-sm font-bold text-black mt-1">${(val.cost || 0).toFixed(4)}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{val.calls || 0} chiamate · {val.tokens || 0} tok</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Dati & Backup */}
          {activeTab === 'data' && (
            <div className="space-y-6">
              <div className="border-b border-black pb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-black">Dati, Knowledge Base & Backup</h2>
                <p className="text-xs text-zinc-500 mt-1 font-sans">Gestisci l&apos;esportazione dei tuoi materiali e lo spazio occupato</p>
              </div>

              {/* Stats cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white border border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                  <div className="flex items-center gap-2 text-zinc-600 mb-1">
                    <Database className="w-4 h-4 text-black" />
                    <span className="font-bold uppercase text-[10px]">Documenti Archiviati</span>
                  </div>
                  <p className="text-2xl font-bold text-black">{data?.totalDocs || 0}</p>
                </div>

                <div className="p-4 bg-white border border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                  <div className="flex items-center gap-2 text-zinc-600 mb-1">
                    <HardDrive className="w-4 h-4 text-black" />
                    <span className="font-bold uppercase text-[10px]">Spazio Storage Cloud</span>
                  </div>
                  <p className="text-2xl font-bold text-black">{data?.totalStorageMB || 0} MB</p>
                </div>
              </div>

              {/* Re-indexing Vectors Card */}
              <div className="p-5 bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 border border-black bg-black text-white flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-black">Sincronizza & Rigenera Vettori pgvector (RAG)</h3>
                    <p className="text-[10px] text-zinc-500 font-sans">Rigenera i vettori semantici per tutti i video YouTube e documenti caricati</p>
                  </div>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed font-sans">
                  Se hai importato video YouTube o documenti prima di configurare la tua API Key, questa funzione estrae le trascrizioni/testi e calcola gli embeddings salvandoli nel database vettoriale per abilitare la ricerca semantica nella Chat e nel Tutor.
                </p>
                <button
                  onClick={handleReindexAllVectors}
                  disabled={reindexingVectors}
                  className="flex items-center gap-2 bg-black hover:bg-zinc-800 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider border border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] transition-colors disabled:opacity-50"
                >
                  {reindexingVectors ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <RefreshCw className="w-4 h-4" />}
                  <span>{reindexingVectors ? 'Rigenerazione in corso...' : 'Rigenera Tutti i Vettori RAG'}</span>
                </button>
              </div>

              {/* Export Button */}
              <div className="p-5 bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] space-y-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-black">Esporta Backup Completo</h3>
                <p className="text-xs text-zinc-600 leading-relaxed font-sans">
                  Scarica in un unico file JSON strutturato tutti i tuoi corsi, metadati dei documenti, sessioni di chat, domande del tutor e flashcard.
                </p>
                <button
                  onClick={handleExportData}
                  disabled={exporting}
                  className="flex items-center gap-2 bg-black hover:bg-zinc-800 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider border border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] transition-colors disabled:opacity-50"
                >
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>Scarica Backup JSON</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 5: Sicurezza & Audit */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="border-b border-black pb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-black">Sicurezza & Audit Log</h2>
                <p className="text-xs text-zinc-500 mt-1 font-sans">Tracciamento delle operazioni sensibili e stato dell&apos;account</p>
              </div>

              {/* Audit Log Table */}
              <div className="border-2 border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                <div className="p-3 bg-zinc-100 border-b border-black font-bold text-xs uppercase tracking-wider text-black">
                  Ultimi 20 Eventi di Audit
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-black text-xs">
                  {(data?.recentAuditLogs || []).length === 0 ? (
                    <p className="p-4 text-zinc-400 uppercase text-center font-bold">Nessun evento di audit registrato</p>
                  ) : (
                    (data.recentAuditLogs as any[]).map(log => (
                      <div key={log.id} className="p-3 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                        <div>
                          <span className="font-bold text-black uppercase">{log.action}</span>
                          <span className="text-zinc-500 text-[11px] ml-2">({log.entity_type})</span>
                        </div>
                        <span className="text-[11px] text-zinc-500 font-mono">
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
