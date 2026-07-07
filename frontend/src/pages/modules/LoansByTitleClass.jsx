import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL;

export default function LoansByTitleClass() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openClasse, setOpenClasse] = useState(null); // classe ouverte

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/reports/loans-by-title-class`, {
          credentials: "include",
        });
        const json = await res.json();
        setData(Array.isArray(json) ? json : []);
      } catch (e) {
        console.error(e);
        setData([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ✅ Grouper par classe
  const grouped = useMemo(() => {
    const map = {};
    for (const r of data) {
      const classe = r.classe || "— Sans classe —";
      if (!map[classe]) map[classe] = [];
      map[classe].push(r);
    }

    // Trier par titre à l'intérieur de chaque classe (optionnel)
    Object.keys(map).forEach((c) => {
      map[c].sort((a, b) =>
        String(a.titre || "").localeCompare(String(b.titre || ""), "fr", { sensitivity: "base" })
      );
    });

    // Retourner une liste triée par nom de classe
    return Object.entries(map).sort(([a], [b]) =>
      String(a).localeCompare(String(b), "fr", { sensitivity: "base" })
    );
  }, [data]);
  console.log("STOCK BACKEND:", data);
  if (loading) return <p className="text-slate-300">Chargement…</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">
        📊 Emprunts par classe (cliquer pour voir les livres)
      </h2>

      {data.length === 0 ? (
        <p className="text-slate-400">Aucune donnée disponible.</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(([classe, rows]) => {
            const totalEnCours = rows.reduce((s, r) => s + Number(r.en_cours || 0), 0);
            const totalRetournes = rows.reduce((s, r) => s + Number(r.retournes || 0), 0);
            const isOpen = openClasse === classe;

            return (
              <div key={classe} className="border border-white/10 rounded">
                {/* ✅ ENTÊTE CLASSE (1 seule fois) */}
                <button
                  type="button"
                  onClick={() => setOpenClasse(isOpen ? null : classe)}
                  className="w-full flex items-center justify-between bg-slate-800 hover:bg-slate-700 px-4 py-3"
                >
                  <div className="font-semibold">
                    {isOpen ? "▼" : "▶"} {classe}
                  </div>

                  <div className="text-sm text-slate-200 flex gap-4">
                    <span>
                      En cours: <b className="text-amber-300">{totalEnCours}</b>
                    </span>
                    <span>
                      Retournés: <b className="text-green-300">{totalRetournes}</b>
                    </span>
                  </div>
                </button>

                {/* ✅ DÉTAILS (liste des livres) */}
                {isOpen && (
                  <div className="overflow-x-auto bg-slate-950">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-900 text-slate-200">
                        <tr>
                          <th className="p-2 border border-white/10 text-left">Livre</th>
                          <th className="p-2 border border-white/10 text-center">En cours</th>
                          <th className="p-2 border border-white/10 text-center">Retournés</th>
                        </tr>
                      </thead>

                      <tbody className="bg-slate-950">
                        {rows.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-800">
                            <td className="p-2 border border-white/10 font-semibold">
                              {r.titre}
                            </td>
                            <td className="p-2 border border-white/10 text-center">
                              {r.en_cours}
                            </td>
                            <td className="p-2 border border-white/10 text-center">
                              {r.retournes}
                            </td>
                          </tr>
                        ))}

                        {/* Ligne Total (optionnelle) */}
                        <tr className="bg-slate-900">
                          <td className="p-2 border border-white/10 font-bold">TOTAL</td>
                          <td className="p-2 border border-white/10 text-center font-bold text-amber-300">
                            {totalEnCours}
                          </td>
                          <td className="p-2 border border-white/10 text-center font-bold text-green-300">
                            {totalRetournes}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}