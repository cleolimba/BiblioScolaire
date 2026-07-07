import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL;

export default function AuthPanel({ onSuccess }) {
  const [mode, setMode] = useState("loading"); // loading | setup | login
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/auth/status`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setMode(data.hasAdmin ? "login" : "setup"))
      .catch(() => setError("Backend inaccessible (vérifie qu'il tourne)."));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");

    try {
      if (mode === "setup") {
        // Phrase de passe recommandée
        if (password.length < 12) return setError("Min 12 caractères.");
        if (password !== password2) return setError("Les mots de passe ne correspondent pas.");

        const r = await fetch(`${API}/auth/setup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ password }),
        });

        const data = await r.json();
        if (!r.ok) return setError(data.message || data.error || "Erreur création");

        setMode("login");
        setPassword("");
        setPassword2("");
        return;
      }

      const r = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });

      const data = await r.json();
      if (!r.ok) return setError(data.message || data.error || "Mot de passe incorrect");

      onSuccess?.();
    } catch {
      setError("Erreur réseau.");
    }
  }

  // if (mode === "loading") return <div className="text-slate-700">Chargement…</div>;

  return (
    <div className="h-full flex flex-col justify-center">
      <h2 className="text-2xl font-bold text-slate-900 mb-6">
        {mode === "setup" ? "Créer mot de passe admin" : "Connexion"}
      </h2>

      <form onSubmit={submit} className="space-y-4">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-amber-700"
        />

        {mode === "setup" && (
          <input
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            placeholder="Confirmer le mot de passe"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-amber-700"
          />
        )}

        {error && (
          <div className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <button className="w-full rounded-lg bg-amber-700 text-white font-semibold py-2 hover:bg-amber-800 transition">
          {mode === "setup" ? "Enregistrer" : "Ouvrir l’application"}
        </button>
      </form>
    </div>
  );
}