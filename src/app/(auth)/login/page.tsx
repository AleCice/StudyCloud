import { login, signup } from './actions'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { message: string }
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-900">Accedi a StudyCloud</h1>
        
        <form className="space-y-4 flex flex-col w-full justify-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
              Email
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900"
              name="email"
              placeholder="tu@universita.it"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
              Password
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900"
              type="password"
              name="password"
              placeholder="••••••••"
              required
            />
          </div>
          
          <div className="pt-2 flex flex-col gap-2">
            <button 
              formAction={login}
              className="w-full py-2 px-4 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition font-medium"
            >
              Accedi
            </button>
            <button 
              formAction={signup}
              className="w-full py-2 px-4 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition font-medium"
            >
              Registrati
            </button>
          </div>
          
          {searchParams?.message && (
            <p className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-md text-center">
              {searchParams.message}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
