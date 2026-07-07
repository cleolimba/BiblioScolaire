import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL;

export default function Needs() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    fetch(`${API}/reports/manual-needs`, { credentials: "include" })
      .then(res => res.json())
      .then(data => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">📦 Besoins en manuels (année prochaine)</h2>

      <div className="overflow-x-auto border border-white/10 rounded">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-slate-200">
            <tr>
              <th className="p-2 border border-white/10">Classe</th>
              <th className="p-2 border border-white/10">Matière</th>
              <th className="p-2 border border-white/10">Élèves</th>
              <th className="p-2 border border-white/10">Manuels</th>
              <th className="p-2 border border-white/10">À acheter</th>
            </tr>
          </thead>

          <tbody className="bg-slate-900">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-800">
                <td className="p-2 border border-white/10">{r.classe}</td>
                <td className="p-2 border border-white/10">{r.matiere}</td>
                <td className="p-2 border border-white/10 text-center">{r.total_eleves}</td>
                <td className="p-2 border border-white/10 text-center">{r.total_manuels}</td>
                <td
                  className={`p-2 border border-white/10 text-center font-bold ${
                    r.a_acheter > 0 ? "text-red-400" : "text-green-400"
                  }`}
                >
                  {r.a_acheter}
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan="5" className="p-4 text-center text-slate-400">
                  Aucune donnée disponible
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 mt-3">
        🔴 = manuels à acheter • ✅ = stock suffisant
      </p>
    </div>
  );
}