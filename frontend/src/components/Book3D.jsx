import { useEffect, useState } from "react";

export default function Book3D({ title, subtitle, isOpen, onOpen, left, right }) {
  const [hideCover, setHideCover] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => setHideCover(true), 900);
      return () => clearTimeout(t);
    } else {
      setHideCover(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e) => {
      if (!isOpen && e.key === "Enter") onOpen?.();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onOpen]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="book-scene">
        <div className={`book-wrap ${isOpen ? "open" : "closed"}`}>
          {/* ✅ Couverture : cliquable seulement quand le livre est fermé */}
          {!hideCover && (
            <div
              className="book-scene"
              // onClick={() => (!isOpen ? onOpen?.() : null)}
              role="button"
              tabIndex={0}
            >
              <div className="cover-content">
                <div className="cover-badge">École</div>
                <h1 className="cover-title">{title}</h1>
                <p className="cover-subtitle">{subtitle}</p>
                <p className="cover-hint">Clique ou Entrée</p>
              </div>
            </div>
          )}

          {/* ✅ Pages : doivent être 100% interactives */}
          <div className="book-pages">
            <div className="pages-grid">
              <div className="page left">{left}</div>
              <div className="page right">{right}</div>
            </div>
            <div className="spine" />
          </div>
        </div>
      </div>
    </div>
  );
}