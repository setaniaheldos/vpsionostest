// server.js
const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// ----------------------
// 🔌 Connexion SQLite
// ----------------------
const dbPath = path.join(__dirname, "database.sqlite");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Erreur connexion SQLite :", err.message);
  } else {
    console.log("✅ SQLite connecté : " + dbPath);
  }
});

// --------------------------------------
// 🛠️ Création automatique de la table
// --------------------------------------
db.run(
  `
  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    age INTEGER,
    maladie TEXT,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`,
  (err) => {
    if (err) {
      console.error("❌ Erreur création table :", err.message);
    } else {
      console.log("✅ Table 'patients' prête");
    }
  }
);

// ----------------------
// 🚀 API Express
// ----------------------

// GET tous les patients
app.get("/patients", (req, res) => {
  db.all("SELECT * FROM patients ORDER BY id DESC", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// POST ajouter un patient
app.post("/patients", (req, res) => {
  const { nom, prenom, age, maladie } = req.body;

  const query =
    "INSERT INTO patients (nom, prenom, age, maladie) VALUES (?, ?, ?, ?)";

  db.run(query, [nom, prenom, age, maladie], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({
        id: this.lastID,
        nom,
        prenom,
        age,
        maladie,
      });
    }
  });
});

// ----------------------
// ▶️ Démarrer le serveur
// ----------------------
app.listen(5000, () => {
  console.log("🚀 Serveur lancé sur port 5000");
});
