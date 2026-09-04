import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="text-4xl font-bold mb-4">Benvenuto su StudyCloud</h1>
      <p className="text-xl text-gray-600 mb-8 max-w-2xl">
        La tua knowledge base personale cloud-first con assistente AI.
      </p>
      
      <div className="flex gap-4">
        <Link 
          href="/login"
          className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:opacity-90 font-medium transition"
        >
          Accedi
        </Link>
        <Link 
          href="/api/health"
          className="px-6 py-3 border border-gray-300 rounded-md hover:bg-gray-50 font-medium transition"
        >
          Stato Sistema
        </Link>
      </div>
    </main>
  );
}
