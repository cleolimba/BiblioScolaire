import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL;

const CATEGORY_OPTIONS = [
  { code: "Rm", libelle: "Roman" },
  { code: "Bd", libelle: "Bande dessinée" },
  { code: "Rc", libelle: "Récit" },
  { code: "Ou", libelle: "Ouvrage" },
  { code: "Po", libelle: "Poésie" },
  { code: "Th", libelle: "Théâtre" },
  { code: "Mp", libelle: "Manuel scolaire – Primaire" },
  { code: "Meb", libelle: "Manuel scolaire – EB" },
  { code: "Mh", libelle: "Manuel scolaire – Humanités" },
];

/**
 * 📚 Books.jsx (PROPRE)
 * - Choix catégorie
 * - Manuels regroupés par matière
 * - Entêtes sticky au scroll
 * - Saisie du stock armoire (dispo) tant que NON verrouillé
 * - Bouton "Valider inventaire" (verrouille définitivement)
 * - Suppression livre (si autorisée côté backend)
 */
export default function Books() {
  const [activeCat, setActiveCat] = useState("");
  const [books, setBooks] = useState([]);

  // saisie temporaire du stock dispo (par id)
  const [dispoDraft, setDispoDraft] = useState({});
  // feedback sauvegarde (par id) : idle | saving | success | error
  const [saveStatus, setSaveStatus] = useState({});

  async function fetchBooks(cat) {
    const params = new URLSearchParams();
    if (cat) params.set("categorie_code", cat);

    const res = await fetch(`${API}/books?${params.toString()}`, {
      credentials: "include",
    });

    const data = await res.json().catch(() => []);
    const list = Array.isArray(data) ? data : [];
    setBooks(list);

    // initialiser les champs d’édition stock
    const nextDraft = {};
    list.forEach((b) => {
      nextDraft[b.id] = String(b.exemplaire_disponible ?? 0);
    });
    setDispoDraft(nextDraft);
  }

  useEffect(() => {
    if (activeCat) fetchBooks(activeCat);
    else {
      setBooks([]);
      setDispoDraft({});
      setSaveStatus({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCat]);

  /**
   * ✅ Sauvegarder le stock armoire (dispo)
   * -> route dédiée backend: PUT /books/:id/stock
   * -> refusée si stock_verrouille=true
   */
  async function saveStockArmoire(bookId) {
    const dispo = Number(dispoDraft[bookId]);

    if (!Number.isFinite(dispo) || dispo < 0) {
      alert("Stock invalide (nombre ≥ 0)");
      return;
    }

    setSaveStatus((p) => ({ ...p, [bookId]: "saving" }));

    try {
      const res = await fetch(`${API}/books/${bookId}/stock`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ exemplaire_disponible: dispo }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveStatus((p) => ({ ...p, [bookId]: "error" }));
        alert(data.message || data.error || "Erreur mise à jour stock");
        return;
      }

      setSaveStatus((p) => ({ ...p, [bookId]: "success" }));

      // recharger la liste pour afficher la valeur confirmée
      await fetchBooks(activeCat);

      setTimeout(() => {
        setSaveStatus((p) => ({ ...p, [bookId]: "idle" }));
      }, 1200);
    } catch (e) {
      console.error(e);
      setSaveStatus((p) => ({ ...p, [bookId]: "error" }));
    }
  }

  /**
   * 🔒 Verrouiller le stock (inventaire terminé)
   * -> route backend: POST /books/:id/lock-stock
   */
  async function lockStock(bookId) {
    if (!confirm("Verrouiller le stock ? Après ça, tu ne pourras plus modifier manuellement.")) return;

    const res = await fetch(`${API}/books/${bookId}/lock-stock`, {
      method: "POST",
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.message || data.error || "Erreur verrouillage");
      return;
    }

    await fetchBooks(activeCat);
  }

  /**
   * 🗑️ Supprimer un livre
   * -> route backend: DELETE /books/:id (backend doit refuser si emprunts EN_COURS)
   */
  async function deleteBook(bookId) {
    if (!confirm("Supprimer ce livre ?")) return;

    const res = await fetch(`${API}/books/${bookId}`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.message || data.error || "Erreur suppression");
      return;
    }

    await fetchBooks(activeCat);
  }

  /**
   * Regroupement par matière pour Mp/Meb/Mh
   */
  const groupedByMatiere = useMemo(() => {
    if (!["Mp", "Meb", "Mh"].includes(activeCat)) return null;

    const g = {};
    books.forEach((b) => {
      const mat = (b.matiere || "Non définie").trim();
      if (!g[mat]) g[mat] = [];
      g[mat].push(b);
    });

    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b, "fr"));
  }, [books, activeCat]);

  /**
   * Entêtes sticky : important → mettre le tableau dans un conteneur scrollable
   */
  const TableWrapper = ({ children }) => (
  <div className="border border-white/10 rounded overflow-hidden">
    <div className="max-h-[70vh] overflow-auto">
      {children}
    </div>
  </div>
);

  return (
    <div>
      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold">📚 Livres</h2>
          {activeCat ? (
            <p className="text-slate-300 text-sm mt-1">
              Catégorie : <b>{activeCat}</b>
            </p>
          ) : (
            <p className="text-slate-300 text-sm mt-1">Choisis une catégorie</p>
          )}
        </div>
      </div>

      {/* CATÉGORIES */}
      {!activeCat && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CATEGORY_OPTIONS.map((c) => (
            <button
              key={c.code}
              onClick={() => setActiveCat(c.code)}
              className="bg-slate-900 border border-white/10 rounded p-4 text-left hover:bg-slate-800"
              type="button"
            >
              <div className="text-lg font-bold">{c.code}</div>
              <div className="text-slate-300">{c.libelle}</div>
            </button>
          ))}
        </div>
      )}

      {/* LISTE */}
      {activeCat && (
        <>
          <div className="mb-4">
            <button
              onClick={() => setActiveCat("")}
              className="bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded text-white"
              type="button"
            >
              ⬅ Retour aux catégories
            </button>
          </div>

          {/* MANUELS : GROUPÉS PAR MATIÈRE */}
          {["Mp", "Meb", "Mh"].includes(activeCat) ? (
            <div className="space-y-6">
              {groupedByMatiere?.map(([matiere, list]) => (
                <div key={matiere} className="border border-white/10 rounded">
                  <div className="bg-slate-800 px-3 py-2 font-semibold text-slate-200">
                    📘 {matiere}
                  </div>

                  <TableWrapper>
                    <table className="w-full text-sm">
                      <thead className="bg-slate-900 text-slate-200 sticky top-0 z-10">
                        <tr>
                          <th className="bg-slate-900">N°</th>
                          <th className="bg-slate-900">Titre</th>
                          <th className="bg-slate-900">Auteur</th>
                          <th className="bg-slate-900">Niveau</th>
                          <th className="bg-slate-900">Stock armoire</th>
                          <th className="bg-slate-900">Total</th>
                          <th className="bg-slate-900">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="bg-slate-950">
                        {list.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-800">
                            <td className="p-2 border border-white/10 text-center">{b.numero ?? "-"}</td>
                            <td className="p-2 border border-white/10 font-semibold">{b.titre}</td>
                            <td className="p-2 border border-white/10">{b.auteur || "-"}</td>
                            <td className="p-2 border border-white/10">{b.niveau || "-"}</td>

                            {/* Stock armoire : modifiable seulement si non verrouillé */}
                            <td className="p-2 border border-white/10 text-center">
                              {b.stock_verrouille ? (
                                <span title="Stock verrouillé">🔒 {b.exemplaire_disponible ?? 0}</span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  value={dispoDraft[b.id] ?? "0"}
                                  onChange={(e) =>
                                    setDispoDraft((p) => ({ ...p, [b.id]: e.target.value }))
                                  }
                                  className="w-24 text-center bg-slate-800 border border-white/20 rounded px-2 py-1"
                                  title="Nombre réel dans l’armoire"
                                />
                              )}
                            </td>

                            <td className="p-2 border border-white/10 text-center">{b.exemplaire_total ?? 0}</td>

                            <td className="p-2 border border-white/10 text-center space-x-2">
                              {/* Enregistrer stock */}
                              {!b.stock_verrouille && (
                                <button
                                  type="button"
                                  onClick={() => saveStockArmoire(b.id)}
                                  className="px-2 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-60"
                                  disabled={saveStatus[b.id] === "saving"}
                                >
                                  {saveStatus[b.id] === "saving"
                                    ? "⏳..."
                                    : saveStatus[b.id] === "success"
                                    ? "✅ OK"
                                    : saveStatus[b.id] === "error"
                                    ? "❌"
                                    : "💾"}
                                </button>
                              )}

                              {/* Verrouiller */}
                              {!b.stock_verrouille && (
                                <button
                                  type="button"
                                  onClick={() => lockStock(b.id)}
                                  className="px-2 py-1 rounded text-xs bg-red-700 hover:bg-red-800"
                                  title="Verrouiller le stock (inventaire terminé)"
                                >
                                  🔒
                                </button>
                              )}

                              {/* Supprimer */}
                              <button
                                type="button"
                                onClick={() => deleteBook(b.id)}
                                className="px-2 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700"
                                title="Supprimer le livre"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableWrapper>
                </div>
              ))}
            </div>
          ) : (
            // AUTRES CATÉGORIES
            <TableWrapper>
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-2 border border-white/10 bg-slate-900">N°</th>
                    <th className="p-2 border border-white/10 bg-slate-900">Titre</th>
                    <th className="p-2 border border-white/10 bg-slate-900">Auteur</th>
                    <th className="p-2 border border-white/10 bg-slate-900">Dispo</th>
                    <th className="p-2 border border-white/10 bg-slate-900">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-slate-900">
                  {books.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800">
                      <td className="p-2 border border-white/10 text-center">{b.numero ?? "-"}</td>
                      <td className="p-2 border border-white/10 font-semibold">{b.titre}</td>
                      <td className="p-2 border border-white/10">{b.auteur || "-"}</td>
                      <td className="p-2 border border-white/10 text-center">{b.exemplaire_disponible ?? 0}</td>
                      <td className="p-2 border border-white/10 text-center">{b.exemplaire_total ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrapper>
          )}
        </>
      )}
    </div>
  );
}