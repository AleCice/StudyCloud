'use client'

import { useState } from 'react'

interface Course {
  id: string
  name: string
}

interface TutorConfigProps {
  courses: Course[]
  onStartSession: (courseId: string, difficulty: string) => void
}

export default function TutorConfig({ courses, onStartSession }: TutorConfigProps) {
  const [courseId, setCourseId] = useState(courses[0]?.id || '')
  const [difficulty, setDifficulty] = useState('Medio')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!courseId) return
    onStartSession(courseId, difficulty)
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-xl font-semibold text-slate-800 mb-6">Configura Sessione di Ripasso</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Corso da ripassare</label>
          <select 
            value={courseId} 
            onChange={e => setCourseId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 p-3 bg-slate-50 focus:border-teal-500 focus:ring-teal-500"
            required
          >
            <option value="" disabled>Seleziona un corso</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Livello di Difficoltà</label>
          <div className="flex gap-4">
            {['Facile', 'Medio', 'Difficile'].map(level => (
              <label key={level} className="flex-1 cursor-pointer">
                <input 
                  type="radio" 
                  name="difficulty" 
                  value={level}
                  checked={difficulty === level}
                  onChange={e => setDifficulty(e.target.value)}
                  className="sr-only"
                />
                <div className={`text-center p-3 rounded-xl border transition-all ${difficulty === level ? 'border-teal-500 bg-teal-50 text-teal-700 font-medium' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                  {level}
                </div>
              </label>
            ))}
          </div>
        </div>

        <button 
          type="submit"
          disabled={!courseId}
          className="w-full py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition disabled:opacity-50"
        >
          Inizia Ripasso
        </button>
      </form>
    </div>
  )
}
