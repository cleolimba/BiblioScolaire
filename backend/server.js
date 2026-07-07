require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const crypto = require("crypto");
const argon2 = require("argon2");
const { Pool } = require("pg");

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const PORT = 3333;
const COOKIE_NAME = "biblio_session";

/* =======================
   MIDDLEWARES
======================= */
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));

app.get("/", (_, res) => res.send("✅ API Bibliothèque OK"));

/* =======================
   UTILS
======================= */
function sha256(x) {
  return crypto.createHash("sha256").update(x).digest("hex");
}
function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}
function cookieOptions() {
  return { httpOnly: true, sameSite: "strict", path: "/" };
}

async function requireSession(req, res, next) {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: "UNAUTHORIZED" });

    const hash = sha256(token + process.env.AUTH_PEPPER);
    const r = await pool.query(
      "SELECT 1 FROM sessions WHERE token_hash=$1 AND expires_at > NOW()",
      [hash]
    );
    if (r.rowCount === 0) return res.status(401).json({ error: "UNAUTHORIZED" });

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
}

function normTitre(t) {
  return String(t || "").trim().toLowerCase();
}

/* =======================
   AUTH
======================= */
app.post("/auth/login", async (req, res) => {
  try {
    const { password } = req.body;

    const r = await pool.query("SELECT password_hash FROM admin_users LIMIT 1");
    if (r.rowCount === 0) return res.status(400).json({ error: "NO_ADMIN" });

    const ok = await argon2.verify(r.rows[0].password_hash, password + process.env.AUTH_PEPPER);
    if (!ok) return res.status(401).json({ error: "BAD_PASSWORD" });

    const token = randomToken();
    const hash = sha256(token + process.env.AUTH_PEPPER);
    const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000);

    await pool.query("INSERT INTO sessions(token_hash, expires_at) VALUES($1,$2)", [hash, expires]);

    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

app.post("/auth/logout", requireSession, async (req, res) => {
  try {
    const token = req.cookies[COOKIE_NAME];
    const hash = sha256(token + process.env.AUTH_PEPPER);
    await pool.query("DELETE FROM sessions WHERE token_hash=$1", [hash]);
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

// ✅ Vérifier si un admin existe
app.get("/auth/status", async (req, res) => {
  try {
    const r = await pool.query("SELECT 1 FROM admin_users LIMIT 1");

    res.json({
      hasAdmin: r.rowCount > 0
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});


// ✅ Création du premier mot de passe admin
app.post("/auth/setup", async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 12) {
      return res.status(400).json({
        error: "WEAK_PASSWORD",
        message: "Minimum 12 caractères"
      });
    }

    // vérifier s'il existe déjà un admin
    const exists = await pool.query("SELECT 1 FROM admin_users LIMIT 1");

    if (exists.rowCount > 0) {
      return res.status(400).json({
        error: "ADMIN_ALREADY_EXISTS"
      });
    }

    const hash = await argon2.hash(password + process.env.AUTH_PEPPER);

    await pool.query(
      "INSERT INTO admin_users(password_hash) VALUES($1)",
      [hash]
    );

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/* =======================
   DATES / STATUT
======================= */
const MANUAL_CODES = ["Mp", "Meb", "Mh"];
const FIXED_MANUAL_DUE = "2026-06-30"; // ✅ fin juin (comme tu veux)

function calcRetourPrevu(dateEmprunt, categorie) {
  // ✅ Manuels : fin juin (fixe)
  if (MANUAL_CODES.includes(categorie)) return FIXED_MANUAL_DUE;

  // ✅ Lecture : +14 jours (tu peux mettre 7 si tu veux)
  const d = new Date(dateEmprunt || new Date());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

// ✅ jours restants = date_retour_prevue - aujourd’hui
function calcStatut(dateRetourPrevue, statut) {
  if (statut === "RETOURNE") return "✅ RETOURNÉ";
  if (statut === "PERDU") return "❌ PERDU";
  if (!dateRetourPrevue) return "EN COURS";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const retour = new Date(dateRetourPrevue);
  retour.setHours(0, 0, 0, 0);

  const diffMs = retour - today;
  const diffDays = Math.ceil(diffMs / 86400000);

  if (diffDays < 0) return `🚨 RETARD (${Math.abs(diffDays)} jours)`;
  if (diffDays <= 30) return `🔴 ${diffDays}`;
  if (diffDays <= 60) return `🟠 ${diffDays}`;
  return `⏳ ${diffDays}`;
}

async function recalcTotalForTitle(client, titreLike, categorieCode, niveau) {

  const key = normTitre(titreLike);
  if (!key || !categorieCode) return;

  // ✅ DISPONIBLE (table livres)
  const dispoRes = await client.query(
    `
    SELECT COALESCE(SUM(exemplaire_disponible), 0)::int AS dispo
    FROM livres
    WHERE LOWER(TRIM(titre)) = $1
      AND categorie_code = $2
      AND niveau = $3
    `,
    [key, categorieCode, niveau]
  );

  const dispo = Number(dispoRes.rows[0]?.dispo || 0);

  // ✅ EN COURS (table emprunts)
  const encoursRes = await client.query(
  `
  SELECT COUNT(*)::int AS cnt
  FROM emprunts
  WHERE statut='EN_COURS'
    AND LOWER(TRIM(livre_titre)) = $1
    AND categorie_code = $2
    AND lecteur_niveau = $3
  `,
  [key, categorieCode, niveau]
);

  const enCours = Number(encoursRes.rows[0]?.cnt || 0);

  const total = dispo + enCours;

  // ✅ UPDATE livres
  await client.query(
    `
    UPDATE livres
    SET exemplaire_total = $4
    WHERE LOWER(TRIM(titre)) = $1
      AND categorie_code = $2
      AND niveau = $3
    `,
    [key, categorieCode, niveau, total]
  );
}
/* =======================
   LIVRES
======================= */
app.get("/books", requireSession, async (req, res) => {
  try {
    const { categorie_code } = req.query;
    let sql = "SELECT * FROM livres";
    const params = [];

    if (categorie_code) {
      sql += " WHERE categorie_code=$1";
      params.push(categorie_code);
    }

    sql += " ORDER BY lower(titre)";
    const r = await pool.query(sql, params);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

// ✅ AJOUTER / RENFORCER UN LIVRE
// si titre existe déjà -> augmenter exemplaire_total + exemplaire_disponible
app.post("/books", requireSession, async (req, res) => {
  try {
    const { titre, auteur, categorie_code, matiere, niveau, prix, exemplaire_total } = req.body;
    if (!titre || !categorie_code) return res.status(400).json({ error: "CHAMPS_OBLIGATOIRES" });

    const key = normTitre(titre);
    const qty = Number(exemplaire_total || 1);

    // chercher existant par titre normalisé
    const existing = await pool.query(
      `
      SELECT id, titre, categorie_code
      FROM livres
      WHERE LOWER(TRIM(titre)) = $1
        AND categorie_code = $2
        AND niveau = $3
      LIMIT 1
      `,
      [key, categorie_code, niveau || null]
    );

    if (existing.rowCount > 0) {
      const bookId = existing.rows[0].id;

      await pool.query(
        `
        UPDATE livres
        SET exemplaire_total = COALESCE(exemplaire_total,0) + $1,
            exemplaire_disponible = COALESCE(exemplaire_disponible,0) + $1
        WHERE id = $2
        `,
        [qty, bookId]
      );

      // recalcul total global du titre
      await recalcTotalForTitle(pool, existing.rows[0].titre, existing.rows[0].categorie_code, existing.rows[0].niveau);
      return res.json({ ok: true, merged: true, id: bookId });
    }

    // sinon création
    const r = await pool.query(
      `
      INSERT INTO livres
      (titre, auteur, categorie_code, matiere, niveau, prix, exemplaire_total, exemplaire_disponible)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
      RETURNING *
      `,
      [
        String(titre).trim(),
        auteur || null,
        categorie_code,
        matiere || null,
        niveau || null,
        Number(prix || 0),
        qty,
      ]
    );

    await recalcTotalForTitle(pool, r.rows[0].titre, r.rows[0].categorie_code, r.rows[0].niveau);    
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

// ✅ Modifier stock MANUEL
app.put("/books/:id/stock", requireSession, async (req, res) => {
  try {
    const { id } = req.params;
    const dispo = Number(req.body.exemplaire_disponible);

    const cur = await pool.query("SELECT id, titre, categorie_code, niveau, stock_verrouille FROM livres WHERE id=$1", [id]);
    if (cur.rowCount === 0) return res.status(404).json({ error: "NOT_FOUND" });

    if (cur.rows[0].stock_verrouille) return res.status(403).json({ error: "STOCK_VERROUILLE" });

    await pool.query("UPDATE livres SET exemplaire_disponible=$1 WHERE id=$2", [dispo, id]);

    await recalcTotalForTitle(pool, cur.rows[0].titre, cur.rows[0].categorie_code, cur.rows[0].niveau);  
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

// 🔒 Verrouiller stock
app.post("/books/:id/lock-stock", requireSession, async (req, res) => {
  try {
    await pool.query("UPDATE livres SET stock_verrouille=true WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

/* =======================
   EMPRUNTS
======================= */

// ✅ LISTE EMPRUNTS (comme avant)
app.get("/loans", requireSession, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        id,
        lecteur_nom,
        lecteur_prenom,
        lecteur_niveau,
        livre_id,
        livre_titre,
        categorie_code,
        statut,
        date_emprunt,
        date_retour_prevue,
        date_retour_effective,
        paye
      FROM emprunts
      ORDER BY date_emprunt DESC
    `);

    const rows = r.rows.map((loan) => ({
      ...loan,
      statut_affichage: calcStatut(loan.date_retour_prevue, loan.statut),
    }));

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

// ✅ CRÉER EMPRUNT
app.post("/loans", requireSession, async (req, res) => {
  const client = await pool.connect();
  try {
    const { lecteur_nom, lecteur_prenom, lecteur_niveau, livre_id, date_emprunt, etat_sortie } = req.body;

    await client.query("BEGIN");

    const bookRes = await client.query("SELECT * FROM livres WHERE id=$1", [livre_id]);
    if (bookRes.rowCount === 0) throw new Error("LIVRE_INTROUVABLE");

    const book = bookRes.rows[0];
    if ((book.exemplaire_disponible ?? 0) <= 0) throw new Error("STOCK_INSUFFISANT");

    const empruntDate = date_emprunt ? String(date_emprunt).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const retourPrevu = calcRetourPrevu(empruntDate, book.categorie_code);

    await client.query(
      `
      INSERT INTO emprunts
      (livre_id, lecteur_nom, lecteur_prenom, lecteur_niveau, livre_titre, categorie_code, statut, date_emprunt, date_retour_prevue, etat_sortie)
      VALUES ($1,$2,$3,$4,$5,$6,'EN_COURS',$7,$8,$9)
      `,
      [
        livre_id,
        lecteur_nom,
        lecteur_prenom,
        lecteur_niveau || null,
        book.titre,
        book.categorie_code,
        empruntDate,
        retourPrevu,
        etat_sortie || null,
      ]
    );

    await client.query(
      "UPDATE livres SET exemplaire_disponible = exemplaire_disponible - 1 WHERE id=$1",
      [livre_id]
    );

    await recalcTotalForTitle(client, book.titre, book.categorie_code, book.niveau);
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: err.message || "DB_ERROR" });
  } finally {
    client.release();
  }
});

// ✅ RETOUR
app.post("/loans/:id/return", requireSession, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const loanRes = await client.query("SELECT * FROM emprunts WHERE id=$1 AND statut='EN_COURS'", [req.params.id]);
    if (loanRes.rowCount === 0) throw new Error("IMPOSSIBLE");

    const loan = loanRes.rows[0];

    const { etat_retour } = req.body;  // ✅ AJOUT

    await client.query(
      `
      UPDATE emprunts 
      SET 
        statut='RETOURNE',
        etat_retour=$2,   -- ✅ AJOUT
        date_retour_effective = COALESCE(date_retour_effective, NOW()::date)
      WHERE id=$1
      `,
      [req.params.id, etat_retour]
    );

    await client.query(
      "UPDATE livres SET exemplaire_disponible = exemplaire_disponible + 1 WHERE id=$1",
      [loan.livre_id]
    );

    // recalcul total global du titre (via loan.livre_titre)
    await recalcTotalForTitle(client, loan.livre_titre, loan.categorie_code, loan.lecteur_niveau);

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: err.message || "DB_ERROR" });
  } finally {
    client.release();
  }
});

// ✅ PERDU
app.post("/loans/:id/lost", requireSession, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const loanRes = await client.query("SELECT * FROM emprunts WHERE id=$1 AND statut='EN_COURS'", [req.params.id]);
    if (loanRes.rowCount === 0) throw new Error("IMPOSSIBLE");

    const loan = loanRes.rows[0];

    await client.query("UPDATE emprunts SET statut='PERDU', paye=false WHERE id=$1", [req.params.id]);

    await recalcTotalForTitle(client, loan.livre_titre, loan.categorie_code, loan.lecteur_niveau);

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: err.message || "DB_ERROR" });
  } finally {
    client.release();
  }
});

// ✅ PAYÉ
app.post("/loans/:id/pay", requireSession, async (req, res) => {
  const client = await pool.connect();
  try {
    const { facture_ref, facture_date, facture_montant } = req.body || {};
    await client.query("BEGIN");

    const loanRes = await client.query("SELECT * FROM emprunts WHERE id=$1 AND statut='PERDU'", [req.params.id]);
    if (loanRes.rowCount === 0) throw new Error("IMPOSSIBLE");

    const loan = loanRes.rows[0];

    await client.query(
      `
      UPDATE emprunts
      SET paye=true, facture_ref=$2, facture_date=$3, facture_montant=$4
      WHERE id=$1
      `,
      [req.params.id, facture_ref || null, facture_date || null, facture_montant || null]
    );

    // remplacement : on remet 1 dispo (si tu considères que paiement = remplacement)
    await client.query(
      "UPDATE livres SET exemplaire_disponible = exemplaire_disponible + 1 WHERE id=$1",
      [loan.livre_id]
    );

    await recalcTotalForTitle(client, loan.livre_titre, loan.categorie_code, loan.lecteur_niveau);

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: err.message || "DB_ERROR" });
  } finally {
    client.release();
  }
});

// ✅ MODIFIER UN EMPRUNT (recalcule date_retour_prevue)
app.put("/loans/:id", requireSession, async (req, res) => {
  try {
    const { id } = req.params;
    const { lecteur_nom, lecteur_prenom, lecteur_niveau, etat_sortie, date_emprunt, date_retour_effective } = req.body;

    const existing = await pool.query("SELECT * FROM emprunts WHERE id=$1", [id]);
    if (existing.rowCount === 0) return res.status(404).json({ error: "EMPRUNT_INTROUVABLE" });
    if (existing.rows[0].statut !== "EN_COURS") return res.status(400).json({ error: "MODIFICATION_INTERDITE" });

    const cur = existing.rows[0];
    const newDateEmprunt = date_emprunt ? String(date_emprunt).slice(0, 10) : String(cur.date_emprunt).slice(0, 10);
    const newRetour = calcRetourPrevu(newDateEmprunt, cur.categorie_code);

    await pool.query(
      `
      UPDATE emprunts
      SET lecteur_nom=$1,
          lecteur_prenom=$2,
          lecteur_niveau=$3,
          etat_sortie=$4,
          date_emprunt=$5::date,
          date_retour_prevue=$6::date,
          date_retour_effective=$7
      WHERE id=$7
      `,
    [
      lecteur_nom,
      lecteur_prenom,
      lecteur_niveau || null,
      etat_sortie || null,
      newDateEmprunt,
      newRetour,
      date_retour_effective || null,  // ✅ AJOUT
      id,
    ]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

// ✅ SUPPRIMER UN EMPRUNT (erreur de saisie)
app.delete("/loans/:id", requireSession, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const loanRes = await client.query("SELECT * FROM emprunts WHERE id=$1", [req.params.id]);
    if (loanRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    const loan = loanRes.rows[0];

    if (loan.statut === "EN_COURS" && loan.livre_id) {
      await client.query(
        "UPDATE livres SET exemplaire_disponible = exemplaire_disponible + 1 WHERE id=$1",
        [loan.livre_id]
      );
    }

    await client.query("DELETE FROM emprunts WHERE id=$1", [req.params.id]);

    await recalcTotalForTitle(client, loan.livre_titre, loan.categorie_code, loan.lecteur_niveau);

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "DB_ERROR" });
  } finally {
    client.release();
  }
});

/* =======================
   FICHES MANUELS (≥2 EN_COURS)
======================= */
app.get("/manual-folders", requireSession, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        lecteur_nom,
        lecteur_prenom,
        lecteur_niveau,
        COUNT(*)::int AS total_manuels
      FROM emprunts
      WHERE statut='EN_COURS'
        AND categorie_code IN ('Mp','Meb','Mh')
      GROUP BY lecteur_nom, lecteur_prenom, lecteur_niveau
      HAVING COUNT(*) >= 2
      ORDER BY lecteur_niveau, lecteur_nom, lecteur_prenom
    `);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

app.get("/manual-folders/details", requireSession, async (req, res) => {
  try {
    const { nom, prenom } = req.query;
    const r = await pool.query(
      `
      SELECT        
        id,
        livre_id,
        livre_titre,
        etat_sortie,
        date_emprunt,
        date_retour_prevue,
        date_retour_effective,
        etat_retour
      FROM emprunts
      WHERE lecteur_nom=$1 AND lecteur_prenom=$2
        AND statut='EN_COURS'
        AND categorie_code IN ('Mp','Meb','Mh')
      ORDER BY date_emprunt
      `,
      [nom, prenom]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

/* =======================
   REPORTS
======================= */
app.get("/reports/loans-by-title-class", requireSession, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        lecteur_niveau AS classe,
        livre_titre AS titre,
        COUNT(*) FILTER (WHERE statut='EN_COURS')::int AS en_cours,
        COUNT(*) FILTER (WHERE statut='RETOURNE')::int AS retournes
      FROM emprunts
      GROUP BY lecteur_niveau, livre_titre
      ORDER BY lecteur_niveau, livre_titre
    `);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB_ERROR" });
  }
});

// ✅ Stock total par titre (calcul fiable sans JOIN qui double les sommes)
app.get("/reports/stock-by-title", requireSession, async (req, res) => {
  try {
    const livres = await pool.query(`SELECT titre, categorie_code, exemplaire_disponible FROM livres`);
    const emprunts = await pool.query(`SELECT livre_titre, categorie_code FROM emprunts WHERE statut='EN_COURS'`);

    const stockMap = {};

    // DISPONIBLES
    for (const livre of livres.rows) {
      const key = `${normTitre(livre.titre)}|${livre.categorie_code}`;

      if (!stockMap[key]) {
        stockMap[key] = {
          titre: livre.titre,
          categorie_code: livre.categorie_code,
          disponibles: 0,
          en_cours: 0,
          total: 0,
        };
      }

      stockMap[key].disponibles += Number(livre.exemplaire_disponible || 0);
    }

    // EN COURS
    for (const emp of emprunts.rows) {
      const key = `${normTitre(emp.livre_titre)}|${emp.categorie_code}`;

      if (!stockMap[key]) {
        stockMap[key] = {
          titre: emp.livre_titre,
          categorie_code: emp.categorie_code,
          disponibles: 0,
          en_cours: 0,
          total: 0,
        };
      }

      stockMap[key].en_cours += 1;
    }

    const result = Object.values(stockMap).map((r) => ({
      ...r,
      total: r.disponibles + r.en_cours,
    }));

    result.sort((a, b) =>
      (a.categorie_code + " " + a.titre).localeCompare(b.categorie_code + " " + b.titre, "fr", {
        sensitivity: "base",
      })
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB_ERROR" });
  }
});
// ✅ SUPPRIMER UN LIVRE
app.delete("/books/:id", requireSession, async (req, res) => {

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;

    // ✅ vérifier si le livre existe
    const bookRes = await client.query(
      "SELECT * FROM livres WHERE id=$1",
      [id]
    );

    if (bookRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    const book = bookRes.rows[0];

    // ✅ vérifier s’il y a des emprunts liés
    const loanCheck = await client.query(
      "SELECT COUNT(*)::int AS total FROM emprunts WHERE livre_id=$1",
      [id]
    );

    if (loanCheck.rows[0].total > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "LIVRE_UTILISE",
        message: "Impossible de supprimer : ce livre est utilisé dans des emprunts"
      });
    }

    // ✅ suppression
    await client.query(
      "DELETE FROM livres WHERE id=$1",
      [id]
    );

    await client.query("COMMIT");

    res.json({ ok: true });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "DB_ERROR" });
  } finally {
    client.release();
  }
});
/* =======================
   START
======================= */
app.listen(PORT, () => {
  console.log(`✅ Backend prêt sur http://localhost:${PORT}`);
});