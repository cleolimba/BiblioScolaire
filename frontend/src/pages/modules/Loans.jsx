import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL;

// Constantes
const WARNING_DAYS = 4;
const MANUAL_CODES = ["Mp", "Meb", "Mh"];

/* =========================================================
   HELPERS (Dates, recherche, badges)
========================================================= */
function todayYMD() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function showDate(v) {
  if (!v) return "-";
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function toMidnight(dateObj) {
  const d = new Date(dateObj);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseISODate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${showDate(dateStr)}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function diffDays(d1, d2) {
  const ms = toMidnight(d1).getTime() - toMidnight(d2).getTime();
  return Math.round(ms / 86400000);
}

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

function includesQ(q, ...fields) {
  const qq = norm(q);
  return fields.some((f) => norm(f).includes(qq));
}

function statusBadge(loan) {
  const txt = loan.statut_affichage || loan.statut;

  if (txt.includes("RETARD")) {
    return {
      text: txt,
      cls: "bg-red-600/20 text-red-300 border-red-600/30",
    };
  }

  if (txt.includes("BIENTÔT")) {
    return {
      text: txt,
      cls: "bg-orange-600/20 text-orange-300 border-orange-600/30",
    };
  }

  if (txt.includes("OK")) {
    return {
      text: txt,
      cls: "bg-green-600/20 text-green-300 border-green-600/30",
    };
  }

  if (txt.includes("RETOURN")) {
    return {
      text: txt,
      cls: "bg-green-600/20 text-green-300 border-green-600/30",
    };
  }

  if (txt.includes("PERDU")) {
    return {
      text: txt,
      cls: "bg-red-600/20 text-red-300 border-red-600/30",
    };
  }

  return {
    text: txt,
    cls: "bg-slate-600/20 text-slate-200 border-white/10",
  };
}

/* =========================================================
   COMPONENT
========================================================= */
export default function Loans() {
  /* -------------------------
     STATE : données
  ------------------------- */
  const [loans, setLoans] = useState([]);
  const [books, setBooks] = useState([]);
  const [folders, setFolders] = useState([]);

  /* -------------------------
     STATE : UI / Filtres
  ------------------------- */
  const [loanView, setLoanView] = useState("LECTURE"); // LECTURE | MP | MEB | MH | FOLDERS
  const [q, setQ] = useState("");
  const [niveauFilter, setNiveauFilter] = useState("TOUS");

  /* -------------------------
     STATE : modal fiche
  ------------------------- */
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderDetails, setFolderDetails] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);

  /* -------------------------
     STATE : modal ajout emprunt
  ------------------------- */
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // si on ajoute depuis une fiche => on bloque les champs lecteur
  const [lockReaderFields, setLockReaderFields] = useState(false);

  const [form, setForm] = useState({
    lecteur_nom: "",
    lecteur_prenom: "",
    lecteur_niveau: "",
    livre_id: "",
    etat_sortie: "B",
    date_emprunt: "",
  });

  /* =========================================================
     ✅ AJOUT : création rapide d'un livre "non enregistré"
     - creatingBook : vrai si l'utilisateur a choisi "Autre livre"
     - newBook : les champs du nouveau livre à enregistrer
  ========================================================= */
  const [creatingBook, setCreatingBook] = useState(false);
 const [newBook, setNewBook] = useState({
  titre: "",
  auteur: "",
  categorie_code: "",
  matiere: "",
  niveau: "",
  prix: "",
  exemplaire_total: 1,
});

  /* -------------------------
     STATE : modal retour
  ------------------------- */
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnLoanId, setReturnLoanId] = useState(null);
  const [returnEtat, setReturnEtat] = useState("B");
  const [returnDate, setReturnDate] = useState(todayYMD);

  /* -------------------------
     STATE : modal modifier
  ------------------------- */
  const [editOpen, setEditOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState(null);

  const [editForm, setEditForm] = useState({
    lecteur_nom: "",
    lecteur_prenom: "",
    lecteur_niveau: "",
    etat_sortie: "B",
    date_emprunt: "",
  });

  /* =========================================================
     HELPERS state
  ========================================================= */
function updateField(k, v) {
  setForm((p) => ({ ...p, [k]: v }));
}

  function closeCreate() {
  setOpen(false);
  setForm({
    lecteur_nom: "",
    lecteur_prenom: "",
    lecteur_niveau: "",
    livre_id: "",
    etat_sortie: "B",
    date_emprunt: "",
    new_titre: "",
    new_categorie: "",
    new_matiere: "",
    new_niveau: "",
    new_total: "",
  });
}

  /* =========================================================
     AUTO-CLASSE (nom+prenom => classe)
========================================================= */
  useEffect(() => {
    const nom = (form.lecteur_nom || "").trim();
    const prenom = (form.lecteur_prenom || "").trim();
    const niveauDeja = (form.lecteur_niveau || "").trim();

    // si niveau déjà renseigné => on ne touche pas
    if (niveauDeja) return;

    // ne chercher que si nom+prenom présents
    if (!nom || !prenom) return;

    // on fait l’auto-classe surtout pour les manuels (MP/MEB/MH) ou quand champs bloqués (fiche)
    const isManualTab = loanView === "MP" || loanView === "MEB" || loanView === "MH";
    if (!isManualTab && !lockReaderFields) return;

    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ nom, prenom });
        const res = await fetch(`${API}/students/lookup?${qs.toString()}`, {
          credentials: "include",
        });
        const data = await res.json();

        if (data.found && data.student?.classe) {
          setForm((p) => ({
            ...p,
            lecteur_niveau: data.student.classe,
          }));
        }
      } catch {
        // ignore
      }
    }, 300);

    return () => clearTimeout(t);
  }, [form.lecteur_nom, form.lecteur_prenom, form.lecteur_niveau, loanView, lockReaderFields]);

  /* =========================================================
     LOADERS (fetch)
  ========================================================= */
  async function loadLoans() {
    const res = await fetch(`${API}/loans`, { credentials: "include" });
    const data = await res.json().catch(() => []);
    setLoans(Array.isArray(data) ? data : []);
  }

  async function loadBooks() {
  const res = await fetch(`${API}/books`, { credentials: "include" });
  const data = await res.json().catch(() => []);
  setBooks(Array.isArray(data) ? data : []);
}

  async function loadFolders() {
    const res = await fetch(`${API}/manual-folders`, { credentials: "include" });
    const data = await res.json().catch(() => []);
    setFolders(Array.isArray(data) ? data : []);
  }

  async function refreshFolderDetails() {
    if (!selectedFolder) return;
    const qs = new URLSearchParams({
      nom: selectedFolder.lecteur_nom,
      prenom: selectedFolder.lecteur_prenom,
    });

    const res = await fetch(`${API}/manual-folders/details?${qs.toString()}`, {
      credentials: "include",
    });
    const data = await res.json().catch(() => []);
    setFolderDetails(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    loadLoans();
    loadBooks();
    loadFolders();
  }, []);

  /* =========================================================
     DERIVED DATA (useMemo)
  ========================================================= */
  const baseVisibleLoans = useMemo(() => {
    if (loanView === "MP") return loans.filter((l) => l.categorie_code === "Mp");
    if (loanView === "MEB") return loans.filter((l) => l.categorie_code === "Meb");
    if (loanView === "MH") return loans.filter((l) => l.categorie_code === "Mh");
    if (loanView === "LECTURE") return loans.filter((l) => !MANUAL_CODES.includes(l.categorie_code));
    return loans;
  }, [loans, loanView]);

  const visibleLoans = useMemo(() => {
    return baseVisibleLoans.filter((l) =>
      includesQ(
        q,
        l.lecteur_nom,
        l.lecteur_prenom,
        l.lecteur_niveau,
        l.livre_titre,
        l.livre_auteur,
        l.categorie_code,
        l.statut
      )
    );
  }, [baseVisibleLoans, q]);

  const niveauxOptions = useMemo(() => {
    const set = new Set();
    folders.forEach((f) => {
      const n = (f.lecteur_niveau || "").trim();
      if (n) set.add(n);
    });
    return ["TOUS", ...Array.from(set).sort((a, b) => a.localeCompare(b, "fr"))];
  }, [folders]);

  const visibleFolders = useMemo(() => {
    return folders.filter((f) => {
      const okNiveau = niveauFilter === "TOUS" ? true : (f.lecteur_niveau || "") === niveauFilter;
      if (!okNiveau) return false;
      return includesQ(q, f.lecteur_nom, f.lecteur_prenom, f.lecteur_niveau, f.total_manuels);
    });
  }, [folders, q, niveauFilter]);

  const visibleBooksForLoan = useMemo(() => {
    // si ajout depuis fiche => seulement manuels
    if (lockReaderFields) {
      return books.filter((b) => MANUAL_CODES.includes(b.categorie_code));
    }
    if (loanView === "MP") return books.filter((b) => b.categorie_code === "Mp");
    if (loanView === "MEB") return books.filter((b) => b.categorie_code === "Meb");
    if (loanView === "MH") return books.filter((b) => b.categorie_code === "Mh");
    return books.filter((b) => !MANUAL_CODES.includes(b.categorie_code));
  }, [books, loanView, lockReaderFields]);

  // blocage si PERDU non payé (même personne)
  const unpaidForThisReader = useMemo(() => {
    const n = norm(form.lecteur_nom);
    const p = norm(form.lecteur_prenom);
    if (!n || !p) return [];
    return loans.filter(
      (l) =>
        l.statut === "PERDU" &&
        l.paye !== true &&
        norm(l.lecteur_nom) === n &&
        norm(l.lecteur_prenom) === p
    );
  }, [loans, form.lecteur_nom, form.lecteur_prenom]);

  const isBlocked = unpaidForThisReader.length > 0;

  /* =========================================================
     ACTIONS
  ========================================================= */
  function openCreate(prefill = null) {
    setForm({
      lecteur_nom: prefill?.lecteur_nom || "",
      lecteur_prenom: prefill?.lecteur_prenom || "",
      lecteur_niveau: prefill?.lecteur_niveau || "",
      livre_id: "",
      etat_sortie: "B",
      date_emprunt: "",
    });

    // ✅ AJOUT : reset de l'ajout livre à chaque ouverture
    setCreatingBook(false);
    setNewBook({
      titre: "",
      auteur: "",
      // astuce: par défaut, si on est dans un onglet manuel, on pré-remplit la catégorie
      categorie_code:
        loanView === "MP" ? "Mp" : loanView === "MEB" ? "Meb" : loanView === "MH" ? "Mh" : "Lecture",
      exemplaire_total: 1,
    });

    setLockReaderFields(!!prefill);
    setOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.lecteur_nom.trim() || !form.lecteur_prenom.trim() || !form.livre_id) return;

    if (isBlocked) {
      alert("Emprunt refusé : cette personne a un livre PERDU non payé.");
      return;
    }

    setLoading(true);
    try {
      /* =========================================================
         ✅ AJOUT : si l'utilisateur a choisi "__NEW__", on crée le livre
         puis on utilise l'id du livre créé pour l'emprunt.
      ========================================================= */
      let livreIdFinal = form.livre_id;

      if (form.livre_id === "__NEW__") {
        // validations simples
        if (!newBook.titre.trim()) {
          alert("❌ Le titre du nouveau livre est obligatoire.");
          return;
        }
        if (!newBook.categorie_code.trim()) {
          alert("❌ La catégorie du nouveau livre est obligatoire.");
          return;
        }

        const payloadBook = {
          titre: newBook.titre.trim(),
          auteur: (newBook.auteur || "").trim() || null,
          categorie_code: newBook.categorie_code.trim(),
          exemplaire_total: Number(newBook.exemplaire_total || 1),        
          matiere: (newBook.matiere || "").trim() || null,
          niveau: (newBook.niveau || "").trim() || null,
          prix: newBook.prix ? Number(String(newBook.prix).replace(",", ".")) : 0,
          
        };

        const resBook = await fetch(`${API}/books`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payloadBook),
        });

        const created = await resBook.json().catch(() => ({}));
        if (!resBook.ok) {
          alert(created.message || created.error || "Erreur lors de l'enregistrement du livre.");
          return;
        }

        // on récupère l'id (robuste selon la forme de la réponse)
        livreIdFinal = created.id || created.book?.id || created.data?.id;

        if (!livreIdFinal) {
          alert("Livre créé mais id introuvable (réponse API inattendue).");
          return;
        }
      }

      // payload emprunt (identique à ton code, sauf livre_id)
      const payload = {
        lecteur_nom: form.lecteur_nom.trim(),
        lecteur_prenom: form.lecteur_prenom.trim(),
        lecteur_niveau: form.lecteur_niveau.trim() || null,
        livre_id: livreIdFinal, // ✅ ici on met l'id final (existant ou créé)
        etat_sortie: form.etat_sortie,
        date_emprunt: form.date_emprunt ? form.date_emprunt : null,
      };

      const res = await fetch(`${API}/loans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === "LECTURE_DEJA_EN_COURS") alert("❌ Ce lecteur a déjà un livre de lecture non rendu.");
        else if (data.error === "MANUEL_DEJA_EMPRUNTE") alert("❌ Ce manuel est déjà emprunté par ce lecteur.");
        else alert(data.message || data.error || "Erreur lors de l'emprunt");
        return;
      }

      closeCreate();
      await loadLoans();
      await loadBooks(); // important: si on a créé un livre, il apparaît maintenant
      await loadFolders();
      await refreshFolderDetails();
    } finally {
      setLoading(false);
    }
  }
async function deleteLoan(id) {
  const ok = window.confirm(
    "⚠️ Supprimer cet emprunt ?\nCette action est définitive."
  );
  if (!ok) return;

  const res = await fetch(`${API}/loans/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    alert(data.message || data.error || "Erreur suppression");
    return;
  }

  await loadLoans();
  await loadBooks();
  await loadFolders();
  await refreshFolderDetails();
}
  async function openFolder(folder) {
    setSelectedFolder(folder);
    setFolderOpen(true);

    const qs = new URLSearchParams({ nom: folder.lecteur_nom, prenom: folder.lecteur_prenom });
    const res = await fetch(`${API}/manual-folders/details?${qs.toString()}`, { credentials: "include" });
    const data = await res.json().catch(() => []);
    setFolderDetails(Array.isArray(data) ? data : []);
  }

  function openReturn(id) {
    setReturnLoanId(id);
    setReturnEtat("B");
    setReturnDate(todayYMD());
    setReturnOpen(true);
  }

  async function confirmReturn(e) {
    e.preventDefault();
    if (!returnLoanId) return;

    const payload = {
      etat_retour: returnEtat,
      date_retour_effective: returnDate ? returnDate : null,
    };

    const res = await fetch(`${API}/loans/${returnLoanId}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || "Erreur retour");
      return;
    }

    setReturnOpen(false);
    setReturnLoanId(null);

    await loadLoans();
    await loadBooks();
    await loadFolders();
    await refreshFolderDetails();
  }

  async function markLost(id) {
    if (!confirm("Marquer ce livre comme PERDU ?")) return;

    const res = await fetch(`${API}/loans/${id}/lost`, {
      method: "POST",
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || "Erreur PERDU");
      return;
    }

    await loadLoans();
    await loadBooks();
    await loadFolders();
    await refreshFolderDetails();
  }

  async function payLost(id) {
  const facture_ref = prompt("Référence facture (ex: F-2026-001) :");
  if (!facture_ref) return;

  const facture_date = prompt("Date facture (YYYY-MM-DD) :") || null;
  const facture_montant = prompt("Montant payé (ex: 10.00) :") || null;

  const res = await fetch(`${API}/loans/${id}/pay`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ facture_ref, facture_date, facture_montant }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    alert(data.error || "Erreur paiement");
    return;
  }

  await loadLoans();
  await loadBooks(); // important: stock mis à jour
}

  function openEdit(l) {
    setEditingLoan(l);
    setEditForm({
      lecteur_nom: l.lecteur_nom || "",
      lecteur_prenom: l.lecteur_prenom || "",
      lecteur_niveau: l.lecteur_niveau || "",
      etat_sortie: l.etat_sortie || "B",
      date_emprunt: l.date_emprunt ? String(l.date_emprunt).slice(0, 10) : "",
    });
    setEditOpen(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editingLoan) return;

    const payload = {
      lecteur_nom: editForm.lecteur_nom.trim(),
      lecteur_prenom: editForm.lecteur_prenom.trim(),
      lecteur_niveau: editForm.lecteur_niveau.trim() || null,
      etat_sortie: editForm.etat_sortie || null,
      date_emprunt: editForm.date_emprunt || null,
    };

    const res = await fetch(`${API}/loans/${editingLoan.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.message || data.error || "Erreur modification");
      return;
    }

    setEditOpen(false);
    setEditingLoan(null);

    await loadLoans();
    await loadFolders();
    await refreshFolderDetails();
  }

  async function updateReturnDate(id, date) {
    await fetch(`${API}/loans/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        date_retour_effective: date
      }),
    });

    refreshFolderDetails();
  }

  async function updateReturnEtat(id, etat) {
    await fetch(`${API}/loans/${id}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        etat_retour: etat
      }),
    });

    refreshFolderDetails();
  }

  /* =========================================================
     RENDER
  ========================================================= */
  return (
    <div>
      {/* Header */}

      <div className="flex justify-between items-center mb-3">
        <h2 className="text-2xl font-bold">🔄 Emprunts</h2>
        <button
          onClick={() => {
            setSelectedFolder(null);
            openCreate(null);
          }}
          className="bg-amber-700 px-4 py-2 rounded text-white hover:bg-amber-800"
          type="button"
        >
          + Nouvel emprunt
        </button>
      </div>

      {/* Recherche */}
      <div className="mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔎 Rechercher (nom, prénom, niveau, titre, catégorie, statut...)"
          className="w-full border border-white/10 bg-slate-900 text-white rounded px-3 py-2"
        />
        <div className="text-xs text-slate-400 mt-1">La recherche filtre toutes les vues.</div>
      </div>

      {/* Onglets */}
      <div className="flex flex-wrap gap-2 mb-3">
        {["LECTURE", "MP", "MEB", "MH", "FOLDERS"].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setLoanView(k)}
            className={`px-3 py-2 rounded ${
              loanView === k ? "bg-amber-700 text-white" : "bg-slate-800 text-white hover:bg-slate-700"
            }`}
          >
            {k === "LECTURE" && "Lecture"}
            {k === "MP" && "Manuel Primaire (Mp)"}
            {k === "MEB" && "Manuel EB (Meb)"}
            {k === "MH" && "Manuel Humanités (Mh)"}
            {k === "FOLDERS" && "📁 Fiches manuels (≥2)"}
          </button>
        ))}
      </div>

      {/* Filtre niveau (fiches) */}
      {loanView === "FOLDERS" && (
        <div className="mb-3">
          <div className="text-sm text-slate-300 mb-2">Filtrer par niveau / classe :</div>
          <div className="flex flex-wrap gap-2">
            {niveauxOptions.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNiveauFilter(n)}
                className={`px-3 py-1 rounded border ${
                  niveauFilter === n
                    ? "bg-amber-700 text-white border-amber-700"
                    : "bg-slate-900 text-white border-white/10 hover:bg-slate-800"
                }`}
              >
                {n === "TOUS" ? "Tous" : n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===================== CONTENT ===================== */}
      {loanView === "FOLDERS" ? (
        <div className="overflow-x-auto border border-white/10 rounded">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-slate-200">
              <tr>
                <th className="p-2 border border-white/10">Nom</th>
                <th className="p-2 border border-white/10">Prénom</th>
                <th className="p-2 border border-white/10">Classe/Niveau</th>
                <th className="p-2 border border-white/10">Total manuels</th>
                <th className="p-2 border border-white/10">Action</th>
              </tr>
            </thead>
            <tbody className="bg-slate-900">
              {visibleFolders.map((f, idx) => (
                <tr key={idx} className="hover:bg-slate-800">
                  <td className="p-2 border border-white/10 font-semibold">{f.lecteur_nom}</td>
                  <td className="p-2 border border-white/10">{f.lecteur_prenom}</td>
                  <td className="p-2 border border-white/10">{f.lecteur_niveau || "-"}</td>
                  <td className="p-2 border border-white/10 text-center">{f.total_manuels}</td>
                  <td className="p-2 border border-white/10 text-center">
                    <button type="button" onClick={() => openFolder(f)} className="text-blue-300 hover:text-blue-100">
                      Ouvrir la fiche
                    </button>
                  </td>
                </tr>
              ))}
              {visibleFolders.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-4 text-center text-slate-400">
                    Aucun résultat (il faut ≥ 2 manuels EN_COURS)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto border border-white/10 rounded">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-slate-200">
              <tr>
                <th className="p-2 border border-white/10">Lecteur</th>
                <th className="p-2 border border-white/10">Livre</th>
                <th className="p-2 border border-white/10">Cat</th>
                <th className="p-2 border border-white/10">Emprunt</th>
                <th className="p-2 border border-white/10">Retour prévu</th>
                <th className="p-2 border border-white/10">Statut</th>
                <th className="p-2 border border-white/10">Actions</th>
              </tr>
            </thead>

            <tbody className="bg-slate-900">
              {visibleLoans.map((l) => {
                const badge = statusBadge(l);
                return (
                  <tr key={l.id} className="hover:bg-slate-800">
                    <td className="p-2 border border-white/10">
                      <div className="font-semibold">
                        {l.lecteur_nom} {l.lecteur_prenom}
                      </div>
                      <div className="text-xs text-slate-400">{l.lecteur_niveau || "-"}</div>
                    </td>

                    <td className="p-2 border border-white/10">
                      <div className="font-semibold">{l.livre_titre}</div>
                      <div className="text-xs text-slate-400">{l.livre_auteur || "-"}</div>
                    </td>

                    <td className="p-2 border border-white/10 text-center">{l.categorie_code}</td>
                    <td className="p-2 border border-white/10 text-center">{showDate(l.date_emprunt)}</td>
                    <td className="p-2 border border-white/10 text-center">{showDate(l.date_retour_prevue)}</td>

                    <td className="p-2 border border-white/10 text-center">
                      <span className={`inline-block px-2 py-1 rounded border ${badge.cls}`}>{badge.text}</span>
                    </td>

                    <td className="p-2 border border-white/10 text-center space-x-3">
                      {l.statut === "EN_COURS" && (
                        <>
                          <button type="button" onClick={() => openReturn(l.id)} className="text-green-300 hover:text-green-100">
                            Retourner
                          </button>
                          <button type="button" onClick={() => markLost(l.id)} className="text-red-300 hover:text-red-100">
                            Perdu
                          </button>
                          <button type="button" onClick={() => openEdit(l)} className="text-blue-300 hover:text-blue-100">
                            Modifier
                          </button>
                          <button
                          type="button"
                            onClick={() => deleteLoan(l.id)}
                            className="text-red-500 hover:text-red-700 font-semibold"
                          >
                            Supprimer
                          </button>
                        </>
                      )}

                      {l.statut === "PERDU" && l.paye !== true && (
                        <>
                          <span className="text-red-200 text-xs">À payer: {Number(l.montant_perte ?? 0).toFixed(2)} $</span>
                          <button type="button" onClick={() => payLost(l.id)} className="text-green-300 hover:text-green-100">
                            Payer
                          </button>
                        </>
                      )}

                      {l.statut === "PERDU" && l.paye === true && <span className="text-green-300">✅ Payé</span>}

                      {l.statut === "RETOURNE" && <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                );
              })}

              {visibleLoans.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-4 text-center text-slate-400">
                    Aucun résultat
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ===================== MODAL AJOUT EMPRUNT ===================== */}
      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white text-black rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-lg">
            <h3 className="text-2xl font-bold">{lockReaderFields ? "Ajouter un manuel" : "Nouvel emprunt"}</h3>

            <form onSubmit={submit} className="space-y-4 px-2">
              <input
                placeholder="Nom"
                value={form.lecteur_nom}
                onChange={(e) => updateField("lecteur_nom", e.target.value)}
                className="border rounded px-3 py-2 w-full"
                required
                disabled={lockReaderFields}
              />
              <input
                placeholder="Prénom"
                value={form.lecteur_prenom}
                onChange={(e) => updateField("lecteur_prenom", e.target.value)}
                className="border rounded px-3 py-2 w-full"
                required
                disabled={lockReaderFields}
              />
              <input
                placeholder="Classe / Niveau"
                value={form.lecteur_niveau}
                onChange={(e) => updateField("lecteur_niveau", e.target.value)}
                className="border rounded px-3 py-2 w-full"
                disabled={lockReaderFields}
              />

              <input
                type="date"
                value={form.date_emprunt}
                onChange={(e) => updateField("date_emprunt", e.target.value)}
                className="border rounded px-3 py-2 w-full"
              />

              {isBlocked && (
                <div className="bg-red-100 border border-red-300 p-2 rounded text-sm">❌ Emprunt interdit : PERDU non payé.</div>
              )}

              {/* =========================================================
                  ✅ MODIF : ajout d'une option "Autre livre"
                  - Si l'utilisateur choisit "__NEW__", on affiche un formulaire
              ========================================================= */}
              <select
                value={form.livre_id}
                onChange={(e) => {
                  const v = e.target.value;
                  updateField("livre_id", v);

                  // si on choisit "Autre livre" => on affiche les champs du livre
                  const isNew = v === "__NEW__";
                  setCreatingBook(isNew);

                  // petit confort: pré-remplir la catégorie selon l'onglet
                  if (isNew) {
                    setNewBook((p) => ({
                      ...p,
                      categorie_code:
                        loanView === "MP" ? "Mp" : loanView === "MEB" ? "Meb" : loanView === "MH" ? "Mh" : (p.categorie_code || "Lecture"),
                    }));
                  }
                }}
                className="border rounded px-3 py-2 w-full"
                required
              >
                <option value="">-- Choisir un livre disponible --</option>
                {visibleBooksForLoan.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.titre} ({b.categorie_code}) — dispo: {b.exemplaire_disponible}
                  </option>
                ))}

                {/* ✅ AJOUT : choix spécial */}
                <option value="__NEW__">➕ Autre livre (non enregistré)</option>
              </select>

              {/* ✅ AJOUT : formulaire de création de livre (affiché seulement si "__NEW__") */}
            {creatingBook && (
              <div className="border border-slate-300 rounded p-3 bg-slate-50 space-y-2">
                <div className="font-semibold text-sm">📘 Enregistrer un nouveau livre</div>

                <input
                  className="border rounded px-3 py-2 w-full"
                  placeholder="Titre du livre *"
                  value={newBook.titre}
                  onChange={(e) => setNewBook((p) => ({ ...p, titre: e.target.value }))}
                  required
                />

                <input
                  className="border rounded px-3 py-2 w-full"
                  placeholder="Auteur (optionnel)"
                  value={newBook.auteur}
                  onChange={(e) => setNewBook((p) => ({ ...p, auteur: e.target.value }))}
                />

                <select
                  className="border rounded px-3 py-2 w-full"
                  value={newBook.categorie_code}
                  onChange={(e) => setNewBook((p) => ({ ...p, categorie_code: e.target.value }))}
                  required
                >
                  <option value="">-- Catégorie * --</option>
                  <option value="Lecture">Lecture</option>
                  <option value="Mp">Manuel Primaire (Mp)</option>
                  <option value="Meb">Manuel EB (Meb)</option>
                  <option value="Mh">Manuel Humanités (Mh)</option>
                </select>

                {/* ✅ Matière */}
                <input
                  className="border rounded px-3 py-2 w-full"
                  placeholder="Matière (ex : Math, Français...)"
                  value={newBook.matiere}
                  onChange={(e) => setNewBook((p) => ({ ...p, matiere: e.target.value }))}
                />

                {/* ✅ Niveau */}
                <input
                  className="border rounded px-3 py-2 w-full"
                  placeholder="Niveau du manuel (ex : 6e, 5e...)"
                  value={newBook.niveau}
                  onChange={(e) => setNewBook((p) => ({ ...p, niveau: e.target.value }))}
                />

                {/* ✅ Prix */}
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="border rounded px-3 py-2 w-full"
                  placeholder="Prix du livre ($)"
                  value={newBook.prix}
                  onChange={(e) => setNewBook((p) => ({ ...p, prix: e.target.value }))}
                />

                <input
                  type="number"
                  min="1"
                  className="border rounded px-3 py-2 w-full"
                  placeholder="Nombre d'exemplaires *"
                  value={newBook.exemplaire_total}
                  onChange={(e) => setNewBook((p) => ({ ...p, exemplaire_total: e.target.value }))}
                  required
                />

                <div className="text-xs text-slate-600">
                  💡 Le livre sera créé d’abord, puis l’emprunt sera enregistré automatiquement.
                </div>
              </div>
            )}
              <select
                value={form.etat_sortie}
                onChange={(e) => updateField("etat_sortie", e.target.value)}
                className="border rounded px-3 py-2 w-full"
              >
                <option value="TB">Très bon (TB)</option>
                <option value="B">Bon (B)</option>
                <option value="M">Moyen (M)</option>
                <option value="MV">Mauvais (MV)</option>
              </select>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={closeCreate} className="px-4 py-2 border rounded">
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading || isBlocked}
                  className="bg-amber-700 px-4 py-2 rounded text-white disabled:opacity-60"
                >
                  {loading ? "Enregistrement..." : "Valider"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL RETOUR ===================== */}
      {returnOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white text-black rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 sticky top-0 bg-white">Retour du livre</h3>

            <form onSubmit={confirmReturn} className="space-y-3">
              <label className="text-sm font-semibold">Date de retour</label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="border rounded px-3 py-2 w-full"
              />

              <label className="text-sm font-semibold">État au retour</label>
              <select value={returnEtat} onChange={(e) => setReturnEtat(e.target.value)} className="border rounded px-3 py-2 w-full">
                <option value="TB">Très bon (TB)</option>
                <option value="B">Bon (B)</option>
                <option value="M">Moyen (M)</option>
                <option value="MV">Mauvais (MV)</option>
              </select>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setReturnOpen(false)} className="px-4 py-2 border rounded">
                  Annuler
                </button>
                <button type="submit" className="bg-amber-700 px-4 py-2 rounded text-white">
                  Valider retour
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL MODIFIER ===================== */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white text-black rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Modifier l’emprunt</h3>
              <button
                type="button"
                onClick={() => {
                  setEditOpen(false);
                  setEditingLoan(null);
                }}
                className="px-3 py-1 rounded border"
              >
                X
              </button>
            </div>

            <form onSubmit={saveEdit} className="space-y-3">
              <input
                className="border rounded px-3 py-2 w-full"
                placeholder="Nom"
                value={editForm.lecteur_nom}
                onChange={(e) => setEditForm((p) => ({ ...p, lecteur_nom: e.target.value }))}
                required
              />
              <input
                className="border rounded px-3 py-2 w-full"
                placeholder="Prénom"
                value={editForm.lecteur_prenom}
                onChange={(e) => setEditForm((p) => ({ ...p, lecteur_prenom: e.target.value }))}
                required
              />
              <input
                className="border rounded px-3 py-2 w-full"
                placeholder="Classe / Niveau"
                value={editForm.lecteur_niveau}
                onChange={(e) => setEditForm((p) => ({ ...p, lecteur_niveau: e.target.value }))}
              />

              <input
                type="date"
                className="border rounded px-3 py-2 w-full"
                value={editForm.date_emprunt}
                onChange={(e) => setEditForm((p) => ({ ...p, date_emprunt: e.target.value }))}
              />

              <select
                className="border rounded px-3 py-2 w-full"
                value={editForm.etat_sortie}
                onChange={(e) => setEditForm((p) => ({ ...p, etat_sortie: e.target.value }))}
              >
                <option value="TB">Très bon (TB)</option>
                <option value="B">Bon (B)</option>
                <option value="M">Moyen (M)</option>
                <option value="MV">Mauvais (MV)</option>
              </select>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditOpen(false);
                    setEditingLoan(null);
                  }}
                  className="px-4 py-2 border rounded"
                >
                  Annuler
                </button>
                <button type="submit" className="bg-amber-700 px-4 py-2 rounded text-white">
                  Enregistrer
                </button>
              </div>

              <div className="text-xs text-slate-600">⚠️ Modification autorisée uniquement si l’emprunt est <b>EN_COURS</b>.</div>
            </form>
          </div>
        </div>
      )}
      {folderOpen && selectedFolder && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
    <div className="bg-white text-black rounded-lg w-full max-w-3xl max-h-[85vh] flex flex-col">

      {/* HEADER */}
      <div className="px-8 pt-6 pb-4 bg-gray-50">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">
          📁 Fiche manuels – {selectedFolder.lecteur_nom} {selectedFolder.lecteur_prenom}
        </h3>
        <button
          onClick={() => {
            setFolderOpen(false);
            setSelectedFolder(null);
            setFolderDetails([]);
          }}
          className="px-3 py-1 border rounded"
        >
          X
        </button>
      </div>

      {/* INFOS LECTEUR */}
      <div className="mb-4 text-sm">
        Classe / Niveau : <b>{selectedFolder.lecteur_niveau || "-"}</b><br />
        Total manuels : <b>{folderDetails.length}</b>
      </div>
      </div>
      {/* TABLE DES MANUELS */}
      <div className="flex-1 overflow-y-auto p-6">
      <table className="w-full text-sm border mb-20">
        <thead className="bg-slate-200 z-10 bg-black">
          <tr>
            <th className="p-2 border">Livre</th>
            <th className="p-2 border">État sortie</th>
            <th className="p-2 border">Date emprunt</th>
            <th className="p-2 border">Date retour</th>
            <th className="p-2 border">État retour</th>
          </tr>
        </thead>
        <tbody>
          {folderDetails.map((m) => (
            <tr key={m.id}>
              <td className="p-2 border">{m.livre_titre}</td>
              <td className="p-2 border text-center">{m.etat_sortie || "-"}</td>
              <td className="p-2 border text-center">{showDate(m.date_emprunt)}</td>
              <td className="p-2 border text-center">
                <input
                  type="date"
                  value={m.date_retour_effective || ""}
                  onChange={(e) => updateReturnDate(m.id, e.target.value)}
                  className="border px-2 py-1 rounded text-black"
                />
              </td>
              <td className="p-2 border text-center">
                <select
                  value={m.etat_retour || ""}
                  onChange={(e) => updateReturnEtat(m.id, e.target.value)}
                  className="border px-2 py-1 rounded text-black"
                  >
                  <option value="">--</option>
                  <option value="TB">Très bon</option>
                  <option value="B">Bon</option>
                  <option value="AB">Abîmé</option>
                  <option value="M">Moyen</option>
                  <option value="PERDU">Perdu</option>
                </select>
              </td>
            </tr>
          ))}

          {folderDetails.length === 0 && (
            <tr>
              <td colSpan="5" className="p-4 text-center text-slate-400">
                Aucun manuel dans cette fiche
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
      {/* AJOUT MANUEL */}
      <div className="flex justify-end p-4 bg-white">
        <button
          className="bg-amber-700 text-white px-4 py-2 rounded"
          onClick={() => {
            setFolderOpen(false);      // ✅ fermer la fiche
            openCreate(selectedFolder); // ✅ ouvrir le formulaire
          }}
        >
          ➕ Ajouter un manuel
        </button> 
      </div>
    </div>
  </div>
)}
    </div>
  );
}