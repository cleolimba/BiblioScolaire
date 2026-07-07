import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

const API = import.meta.env.VITE_API_URL;

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function monthNow() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`; // YYYY-MM
}

function yearNow() {
  return String(new Date().getFullYear()); // YYYY
}

export default function Reports() {
  // ✅ Période sélectionnée (mois OU année)
  const [period, setPeriod] = useState(monthNow()); // par défaut mois courant
  const [periodMode, setPeriodMode] = useState("month"); // "month" | "year"

  const [mode, setMode] = useState("passages"); // "passages" | "personnes"
  const [rows, setRows] = useState([]);

  async function load() {
    const res = await fetch(`${API}/reports/lecture-by-class?month=${encodeURIComponent(period)}`, {
      credentials: "include",
    });
    const data = await res.json().catch(() => []);
    setRows(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, mode]); // mode n'a pas besoin de reload, mais ce n'est pas grave

  // 🔹 Axe X = classes
  const labels = useMemo(() => rows.map((r) => r.classe), [rows]);

  // 🔹 Axe Y = valeurs selon mode
  const values = useMemo(() => {
    if (mode === "passages") return rows.map((r) => Number(r.total_passages ?? 0));
    return rows.map((r) => Number(r.total_personnes ?? 0));
  }, [rows, mode]);

  const winner = useMemo(() => {
    if (!rows.length) return null;
    const key = mode === "passages" ? "total_passages" : "total_personnes";
    return [...rows].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))[0];
  }, [rows, mode]);

  const chartData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: mode === "passages" ? "Nombre de visites (passages)" : "Nombre de personnes",
          data: values,
          backgroundColor: "rgba(245, 158, 11, 0.75)",
          borderColor: "rgba(245, 158, 11, 1)",
          borderWidth: 1,
        },
      ],
    }),
    [labels, values, mode]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: { display: true },
        tooltip: { enabled: true },
      },
      scales: {
        x: {
          title: { display: true, text: "Classes (salles)" },
          ticks: { color: "#e2e8f0" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: mode === "passages" ? "Nombre de visites (emprunts)" : "Nombre de personnes",
          },
          ticks: { color: "#e2e8f0" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },
    }),
    [mode]
  );

  function switchToMonth() {
    setPeriodMode("month");
    setPeriod(monthNow());
  }

  function switchToYear() {
    setPeriodMode("year");
    setPeriod(yearNow());
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-3">📊 Rapports — Lecture par classe</h2>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        {/* ✅ Choix mode période */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={switchToMonth}
            className={`px-3 py-2 rounded ${
              periodMode === "month" ? "bg-amber-700 text-white" : "bg-slate-800 text-white hover:bg-slate-700"
            }`}
          >
            Mois
          </button>
          <button
            type="button"
            onClick={switchToYear}
            className={`px-3 py-2 rounded ${
              periodMode === "year" ? "bg-amber-700 text-white" : "bg-slate-800 text-white hover:bg-slate-700"
            }`}
          >
            Année
          </button>
        </div>

        {/* ✅ Sélecteur période */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-300">
            {periodMode === "month" ? "Mois :" : "Année :"}
          </label>

          {periodMode === "month" ? (
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded px-3 py-2 text-white"
            />
          ) : (
            <input
              type="number"
              min="2020"
              max="2100"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded px-3 py-2 text-white w-28"
              placeholder="2026"
            />
          )}
        </div>

        {/* ✅ Choix valeurs */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-300">Afficher :</label>

          <label className="text-white flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              checked={mode === "passages"}
              onChange={() => setMode("passages")}
            />
            Visites (passages)
          </label>

          <label className="text-white flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              checked={mode === "personnes"}
              onChange={() => setMode("personnes")}
            />
            Personnes
          </label>
        </div>
      </div>

      {winner && (
        <div className="mb-4 p-3 rounded border border-white/10 bg-slate-900 text-white">
          🏆 <b>Classe la plus active</b> : {winner.classe} —{" "}
          <b>{mode === "passages" ? winner.total_passages : winner.total_personnes}</b>{" "}
          {mode === "passages" ? "visites" : "personnes"}
        </div>
      )}

      <div className="bg-slate-900 border border-white/10 rounded p-4">
        {rows.length === 0 ? (
          <div className="text-slate-400 text-center p-6">
            Aucune donnée de <b>lecture</b> pour cette période.
          </div>
        ) : (
          <Bar data={chartData} options={options} />
        )}
      </div>

      <div className="text-xs text-slate-400 mt-3">
        *Rapport = <b>lecture uniquement</b> (manuels Mp/Meb/Mh exclus).<br />
        *Mois = format <b>YYYY-MM</b>. [1](https://reacthustle.com/blog/react-filter-by-category)[2](https://stackoverflow.com/questions/1752677/how-can-i-recursively-delete-an-entire-directory-with-powershell-2-0)
      </div>
    </div>
  );
}