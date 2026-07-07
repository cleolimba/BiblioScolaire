import { useState } from "react";
import Books from "./modules/Books";
import Loans from "./modules/Loans";
import Reports from "./modules/Reports";
import Settings from "./modules/Settings";
import Needs from "./modules/Needs";
import LoansByTitleClass from "./modules/LoansByTitleClass";
import StockByTitle from "./modules/StockByTitle";
// import ManualNeeds from "./reports/ManualNeeds";

export default function Dashboard({ onLogout }) {
  const [page, setPage] = useState("books");

  return (
    <div className="min-h-screen flex bg-slate-950 text-white">
      {/* ================= SIDEBAR ================= */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 border-r border-white/10 p-4 overflow-y-auto">
        <h1 className="text-xl font-bold mb-6">📚 BiblioScolaire</h1>

        <nav className="space-y-2">
          {/* Livres */}
          <button
            onClick={() => setPage("books")}
            className={`w-full text-left px-3 py-2 rounded ${
              page === "books" ? "bg-amber-700" : "hover:bg-slate-800"
            }`}
          >
            📚 Livres
          </button>

          {/* Lecteurs (bientôt) */}
          <button
            className="w-full text-left px-3 py-2 rounded hover:bg-slate-800 opacity-50"
            disabled
          >
            👤 Lecteurs (bientôt)
          </button>

          {/* Emprunts */}
          <button
            onClick={() => setPage("loans")}
            className={`w-full text-left px-3 py-2 rounded ${
              page === "loans" ? "bg-amber-700" : "hover:bg-slate-800"
            }`}
          >
            🔄 Emprunts
          </button>

          {/* Rapports */}
          <button
            onClick={() => setPage("reports")}
            className={`w-full text-left px-3 py-2 rounded ${
              page === "reports" ? "bg-amber-700" : "hover:bg-slate-800"
            }`}
          >
            📊 Rapports
          </button>
<button
  onClick={() => setPage("loansByTitle")}
  className={`w-full text-left px-3 py-2 rounded ${
    page === "loansByTitle" ? "bg-amber-700" : "hover:bg-slate-800"
  }`}
>
  📚 Emprunts par classe
</button>
<button
  onClick={() => setPage("stockByTitle")}
  className={`w-full text-left px-3 py-2 rounded ${
    page === "stockByTitle" ? "bg-amber-700" : "hover:bg-slate-800"
  }`}
>
  📦 Stock total (par titre)
</button>
          <button
  onClick={() => setPage("settings")}
  className={`w-full text-left px-3 py-2 rounded ${
    page === "settings" ? "bg-amber-700" : "hover:bg-slate-800"
  }`}
>
  ⚙️ Paramètres
</button>

<button
  onClick={() => setPage("needs")}
  className={`w-full text-left px-3 py-2 rounded ${
    page === "needs" ? "bg-amber-700" : "hover:bg-slate-800"
  }`}
>
  📦 Besoins / Achats
</button>
        </nav>

        {/* Déconnexion */}
        <div className="mt-10">
          <button
            onClick={onLogout}
            className="w-full bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded"
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* ================= CONTENU ================= */}
<main className="ml-64 flex-1 h-screen overflow-y-auto p-6">
  {page === "books" && <Books />}
  {page === "loans" && <Loans />}
  {page === "reports" && <Reports />}
  {page === "loansByTitle" && <LoansByTitleClass />}
  {page === "settings" && <Settings />}
  {page === "needs" && <Needs />}
  {page === "stockByTitle" && <StockByTitle />}
</main>
    </div>
  );
}