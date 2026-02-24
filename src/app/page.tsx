import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white">
      <main className="flex flex-col items-center gap-8 text-center px-4">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl drop-shadow-lg">
          Haşere Mücadele
        </h1>
        <p className="text-lg sm:text-2xl max-w-2xl text-indigo-100 font-medium">
          Modern takip ve yönetim sistemi.
        </p>

        <div className="flex gap-4 mt-8">
          <Link
            href="/auth/login"
            className="px-8 py-4 bg-white text-indigo-600 rounded-full font-bold text-lg hover:bg-opacity-90 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
          >
            Giriş Yap
          </Link>
        </div>
      </main>
    </div>
  );
}
