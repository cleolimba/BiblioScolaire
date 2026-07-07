import { useEffect, useState } from "react";
const API = import.meta.env.VITE_API_URL;

export default function ManualDetailByLevel() {
  const [rows, setRows] = useState([]);

  async function load() {
    const res = await fetch(`${API}/reports/manual-detail-by-level`, {
      credentials: "include",
    });
    const data = await res.json().catch(() => []);
    setRows(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">
        📊 Situation des manuels par niveau
      </h2>

      <div className="overflow-x-auto border border-white/10 rounded">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-slate-200">
            <tr>
              <th className="p-2 border">Niveau</th>
              <th className="p-2 border">Titre</th>
              <th className="p-2 border">Élèves</th>
              <th className="p-2 border">Stock armoire</th>
              <th className="p-2 border">Emprunts en cours</th>
              <th className="p-2 border">Remis</th>
              <th className="p-2 border">Total réel</th>
              <th className="p-2 border">Manque</th>
            </tr>
          </thead>

          <tbody className="bg-slate-950">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-800">
                <td className="p-2 border">{r.niveau}</td>
                <td className="p-2 border font-semibold">{r.titre}</td>
                <td className="p-2 border text-center">{r.total_eleves}</td>
                <td className="p-2 border text-center">{r.stock_armoire}</td>
                <td className="p-2 border text-center">{r.emprunts_en_cours}</td>
                <td className="p-2 border text-center">{r.emprunts_remis}</td>
                <td className="p-2 border text-center font-semibold">
                  {r.total_reel}
                </td>
                <td className="p-2 border text-center">
                  {r.manquant > 0 ? (
                    <span className="text-red-400 font-bold">
                      {r.manquant}
                    </span>
                  ) : (
                    <span className="text-green-400">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}