import { useEffect, useState } from "react";

export default function Settings() {
  /* =====================
     THEME
  ===================== */
  const [theme, setTheme] = useState(
    localStorage.getItem("theme") || "dark"
  );

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  /* =====================
     LANGUE
  ===================== */
  const [lang, setLang] = useState(
    localStorage.getItem("lang") || "fr"
  );

  useEffect(() => {
    localStorage.setItem("lang", lang);
  }, [lang]);

  /* =====================
     MOT DE PASSE (UI SEULEMENT)
  ===================== */
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");

  function handlePasswordChange(e) {
    e.preventDefault();
    alert(
      "Fonction non encore activée.\n" +
      "L’interface est prête, il manque juste la route backend."
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-2xl font-bold">⚙️ Paramètres</h2>

      {/* ================= THEME ================= */}
      <div className="bg-slate-900 border border-white/10 rounded p-4">
        <h3 className="font-semibold mb-3">🎨 Thème</h3>

        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="bg-slate-800 border border-white/10 px-3 py-2 rounded text-white"
        >
          <option value="dark">Sombre</option>
          <option value="light">Clair</option>
        </select>

        <p className="text-xs text-slate-400 mt-2">
          Le thème est enregistré automatiquement.
        </p>
      </div>

      {/* ================= LANGUE ================= */}
      <div className="bg-slate-900 border border-white/10 rounded p-4">
        <h3 className="font-semibold mb-3">🌍 Langue</h3>

        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="bg-slate-800 border border-white/10 px-3 py-2 rounded text-white"
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>

        <p className="text-xs text-slate-400 mt-2">
          Langue sélectionnée : <b>{lang === "fr" ? "Français" : "English"}</b>
        </p>
      </div>

      {/* ================= MOT DE PASSE ================= */}
      <div className="bg-slate-900 border border-white/10 rounded p-4">
        <h3 className="font-semibold mb-3">🔑 Mot de passe administrateur</h3>

        <form onSubmit={handlePasswordChange} className="space-y-3">
          <input
            type="password"
            placeholder="Ancien mot de passe"
            value={oldPass}
            onChange={(e) => setOldPass(e.target.value)}
            className="w-full bg-slate-800 border border-white/10 px-3 py-2 rounded text-white"
          />

          <input
            type="password"
            placeholder="Nouveau mot de passe"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            className="w-full bg-slate-800 border border-white/10 px-3 py-2 rounded text-white"
          />

          <button
            type="submit"
            className="bg-amber-700 px-4 py-2 rounded text-white hover:bg-amber-800"
          >
            Modifier le mot de passe
          </button>
        </form>

        <p className="text-xs text-slate-400 mt-2">
          ⚠️ Fonction en préparation (backend requis).
        </p>
      </div>
    </div>
  );
}