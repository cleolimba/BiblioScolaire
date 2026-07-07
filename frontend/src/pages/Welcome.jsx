import { useState } from "react";
import Book3D from "../components/Book3D";
import AuthPanel from "../components/AuthPanel";

export default function Welcome({ onLogged }) {
  const [open, setOpen] = useState(false);

  return (
    <Book3D
      title="BiblioScolaire"
      subtitle="Gestion des emprunts & retours (sécurisé)"
      isOpen={open}
      onOpen={() => setOpen(true)}
      left={
        <div className="h-full flex flex-col justify-between">
          <div>
            <h2 className="text-4xl font-extrabold text-slate-900 leading-tight">
              Bienvenue
            </h2>
            <p className="mt-4 text-slate-700 text-lg">
              Application de gestion de bibliothèque scolaire, utilisable sur PC et Android.
            </p>
            <div className="mt-6 space-y-2 text-slate-700">
              <p>✅ Livres & exemplaires</p>
              <p>✅ Lecteurs (élèves/enseignants)</p>
              <p>✅ Prêt / Retour + retards</p>
              <p>✅ Sécurité : mot de passe hashé serveur</p>
            </div>
          </div>

          <div className="text-xs text-slate-600">
            Astuce : Clique sur le livre ou appuie sur Entrée
          </div>
        </div>
      }
      right={<AuthPanel onSuccess={onLogged} />}
    />
  );
}