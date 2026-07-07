import { useEffect, useState } from "react";
const API = import.meta.env.VITE_API_URL;

export default function StockByTitle() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/reports/stock-by-title`, {
          credentials: "include",
        });
        const json = await res.json();
        setRows(Array.isArray(json) ? json : []);
      } catch (e) {
        console.error(e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <p className="text-slate-300">Chargement…</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">📦 Stock total par titre</h2>

      {rows.length === 0 ? (
        <p className="text-slate-400">Aucune donnée.</p>
      ) : (
        <div className="overflow-x-auto border border-white/10 rounded">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-slate-200">
              <tr>
                <th className="p-2 border border-white/10 text-left">Titre</th>
                <th className="p-2 border border-white/10 text-center">Disponibles</th>
                <th className="p-2 border border-white/10 text-center">En cours</th>
                <th className="p-2 border border-white/10 text-center">Total</th>
              </tr>
            </thead>
            <tbody className="bg-slate-900">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-800">
                  <td className="p-2 border border-white/10 font-semibold">
                    {r.titre}
                  </td>
                  <td className="p-2 border border-white/10 text-center">
                    {r.disponibles}
                  </td>
                  <td className="p-2 border border-white/10 text-center">
                    {r.en_cours}
                  </td>
                  <td className="p-2 border border-white/10 text-center font-bold text-amber-300">
                    {r.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}