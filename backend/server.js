const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());




// Connexion à la base SQLite
const db = new sqlite3.Database('./patient.db', (err) => {
  if (err) return console.error('Erreur de connexion à SQLite :', err.message);
  console.log('✅ Connecté à la base de données SQLite');
});



// 🔧 Création des tables

db.serialize(() => {
  // Table patients
  db.run(`
  CREATE TABLE IF NOT EXISTS patients (
    idPatient INTEGER PRIMARY KEY AUTOINCREMENT, -- Nouvelle clé primaire auto-incrémentée
    cinPatient TEXT,                             -- CIN n'est plus la clé primaire ni unique
    prenom TEXT NOT NULL,
    nom TEXT NOT NULL,
    age INTEGER NOT NULL,
    adresse TEXT,
    email TEXT,                                  -- Email n'est plus unique
    sexe TEXT CHECK (sexe IN ('Homme', 'Femme')),
    telephone TEXT                               -- Téléphone n'est plus unique
  );
`);

  // Table praticiens
  db.run(`
    CREATE TABLE IF NOT EXISTS praticiens (
      cinPraticien TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      telephone TEXT UNIQUE,
      email TEXT UNIQUE,
      specialite TEXT
    );
  `);

  // Table rendezvous
  db.run(`
    CREATE TABLE IF NOT EXISTS rendezvous (
      idRdv INTEGER PRIMARY KEY AUTOINCREMENT,
      cinPatient TEXT NOT NULL,
      cinPraticien TEXT NOT NULL,
      dateHeure DATETIME NOT NULL,
      statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'confirme', 'annule')),
      idRdvParent INTEGER,
      FOREIGN KEY (cinPatient) REFERENCES patients(cinPatient) ON DELETE CASCADE,
      FOREIGN KEY (cinPraticien) REFERENCES praticiens(cinPraticien) ON DELETE CASCADE,
      FOREIGN KEY (idRdvParent) REFERENCES rendezvous(idRdv)
    );
  `);

  // Table consultations
 db.run(`
    CREATE TABLE IF NOT EXISTS consultations (
      idConsult INTEGER PRIMARY KEY AUTOINCREMENT,
      idRdv INTEGER NOT NULL,
      dateConsult DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      compteRendu TEXT,
      prix REAL DEFAULT NULL,  -- ← Nouvelle colonne pour le prix de la consultation
      FOREIGN KEY (idRdv) REFERENCES rendezvous(idRdv) ON DELETE CASCADE
    );
  `, (err) => {
    if (err) {
      // Si la table existe déjà, on ajoute la colonne si elle n'existe pas
      if (err.message.includes("duplicate column name")) {
        console.log("⚠️ Colonne 'prix' déjà existante dans consultations");
      } else {
        // Tentative d'ajouter la colonne si elle n'existe pas (SQLite ≥ 3.35 supporte ALTER TABLE ADD COLUMN)
        db.run(`ALTER TABLE consultations ADD COLUMN prix REAL DEFAULT NULL`, (alterErr) => {
          if (alterErr) {
            console.log("ℹ️ Impossible d'ajouter la colonne 'prix' automatiquement (SQLite ancien ?)");
          } else {
            console.log("✅ Colonne 'prix' ajoutée à la table consultations");
          }
        });
      }
    } else {
      console.log("✅ Table consultations créée avec la colonne prix");
    }
  });



  // Table prescriptions
  db.run(`
    CREATE TABLE IF NOT EXISTS prescriptions (
      idPrescrire INTEGER PRIMARY KEY AUTOINCREMENT,
      idConsult INTEGER NOT NULL,
      typePrescrire TEXT NOT NULL,
      posologie TEXT NOT NULL,
      datePrescrire DATE,
      FOREIGN KEY (idConsult) REFERENCES consultations(idConsult) ON DELETE CASCADE
    );
  `);



  // Table des admins
db.run(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );
`);

// Table des utilisateurs
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    isApproved INTEGER DEFAULT 0 -- 0 = non validé, 1 = validé par l'admin
  );
`);

db.run(`
CREATE TABLE IF NOT EXISTS examen (
  idExamen INTEGER PRIMARY KEY AUTOINCREMENT,
  idConsult INTEGER NOT NULL,
  typeExamen TEXT NOT NULL,
  dateExamen TEXT NOT NULL,
  resultat TEXT,
  FOREIGN KEY (idConsult) REFERENCES consultations(idConsult) ON DELETE CASCADE
);
`);


  console.log('✅ Toutes les tables ont été créées (si elles n’existaient pas)');
});


// Routes CRUD pour patients
app.get('/patients', (req, res) => {
  db.all('SELECT * FROM patients', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST : Ajouter un patient (l'idPatient est auto-incrémenté)
app.post('/patients', (req, res) => {
  // idPatient est auto-généré
  const { cinPatient, prenom, nom, age, adresse, email, sexe, telephone } = req.body;
  db.run(
    // 8 colonnes à insérer: (cinPatient, prenom, nom, age, adresse, email, sexe, telephone)
    `INSERT INTO patients (cinPatient, prenom, nom, age, adresse, email, sexe, telephone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [cinPatient, prenom, nom, age, adresse, email, sexe, telephone],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      // IMPORTANT : Utiliser this.lastID pour obtenir le nouvel idPatient auto-incrémenté
      res.status(201).json({ idPatient: this.lastID }); 
    }
  );
});

// POST : Ajouter un patient (l'idPatient est auto-incrémenté)
app.post('/patients', (req, res) => {
  // idPatient est auto-généré
  const { cinPatient, prenom, nom, age, adresse, email, sexe, telephone } = req.body;
  db.run(
    // 8 colonnes à insérer: (cinPatient, prenom, nom, age, adresse, email, sexe, telephone)
    `INSERT INTO patients (cinPatient, prenom, nom, age, adresse, email, sexe, telephone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [cinPatient, prenom, nom, age, adresse, email, sexe, telephone],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      // IMPORTANT : Utiliser this.lastID pour obtenir le nouvel idPatient auto-incrémenté
      res.status(201).json({ idPatient: this.lastID }); 
    }
  );
});

// DELETE : Supprimer un patient par son nouvel ID
app.delete('/patients/:idPatient', (req, res) => {
  db.run(`DELETE FROM patients WHERE idPatient=?`, [req.params.idPatient], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

// PUT : Modifier un patient par son idPatient (nouvelle route nécessaire !)
app.put('/patients/:idPatient', (req, res) => {
  const { idPatient } = req.params;
  const { cinPatient, prenom, nom, age, adresse, email, sexe, telephone } = req.body;

  db.run(
    `UPDATE patients 
     SET cinPatient = ?, prenom = ?, nom = ?, age = ?, adresse = ?, email = ?, sexe = ?, telephone = ?
     WHERE idPatient = ?`,
    [cinPatient, prenom, nom, age, adresse, email, sexe, telephone, idPatient],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: "Patient non trouvé" });
      }
      res.json({ message: "Patient mis à jour avec succès", idPatient });
    }
  );
});
// GET : Lister tous les patients ou rechercher par nom
// *ATTENTION: Il y a deux routes GET /patients, la plus spécifique doit être avant*
// Cette route ci-dessous est déjà présente et correcte pour la recherche
app.get('/patients', (req, res) => {
  const { nom = '' } = req.query; // Recherche par nom est toujours pertinente
  let sql = 'SELECT * FROM patients WHERE 1=1';
  const params = [];

  if (nom) {
    sql += ' AND LOWER(nom) LIKE ?';
    params.push(`%${nom.toLowerCase()}%`);
  }

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows); // Les résultats incluront le nouvel idPatient
  });
});

// Route GET : Lister les utilisateurs en attente de validation
app.get('/users/pending', (req, res) => {
  db.all('SELECT * FROM users WHERE isApproved = 0', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Route PUT : Valider un utilisateur (autoriser l'accès)
app.put('/users/:id/approve', (req, res) => {
  const { id } = req.params;
  db.run('UPDATE users SET isApproved = 1 WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Utilisateur non trouvé" });
    res.json({ message: "Utilisateur validé avec succès" });
  });
});

// Route DELETE : Refuser/supprimer un utilisateur en attente
app.delete('/users/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM users WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Utilisateur non trouvé" });
    res.json({ message: "Utilisateur supprimé" });
  });
});

//table praticiens


// 📄 Lister tous les praticiens
app.get('/praticiens', (req, res) => {
  db.all('SELECT * FROM praticiens', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ➕ Ajouter un praticien
app.post('/praticiens', (req, res) => {
  const { cinPraticien, nom, prenom, telephone, email, specialite } = req.body;
  const sql = `INSERT INTO praticiens (cinPraticien, nom, prenom, telephone, email, specialite)
               VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(sql, [cinPraticien, nom, prenom, telephone, email, specialite], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Praticien ajouté' });
  });
});

// ✏️ Modifier un praticien
app.put('/praticiens/:cinPraticien', (req, res) => {
  const { nom, prenom, telephone, email, specialite } = req.body;
  const { cinPraticien } = req.params;
  const sql = `UPDATE praticiens SET nom=?, prenom=?, telephone=?, email=?, specialite=? WHERE cinPraticien=?`;
  db.run(sql, [nom, prenom, telephone, email, specialite, cinPraticien], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ message: 'Praticien mis à jour' });
  });
});

// ❌ Supprimer un praticien
app.delete('/praticiens/:cinPraticien', (req, res) => {
  db.run(`DELETE FROM praticiens WHERE cinPraticien = ?`, [req.params.cinPraticien], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ message: 'Praticien supprimé' });
  });
});



// table randezvous


// 📌 ROUTES POUR rendezvous

// GET : Tous les rendez-vous
app.get('/rendezvous', (req, res) => {
  db.all(`SELECT * FROM rendezvous`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST : Créer un rendez-vous
app.post('/rendezvous', (req, res) => {
  const { cinPatient, cinPraticien, dateHeure, statut = 'en_attente', idRdvParent = null } = req.body;
  db.run(
    `INSERT INTO rendezvous (cinPatient, cinPraticien, dateHeure, statut, idRdvParent)
     VALUES (?, ?, ?, ?, ?)`,
    [cinPatient, cinPraticien, dateHeure, statut, idRdvParent],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// PUT : Modifier un rendez-vous
app.put('/rendezvous/:idRdv', (req, res) => {
  const { cinPatient, cinPraticien, dateHeure, statut, idRdvParent } = req.body;
  db.run(
    `UPDATE rendezvous SET cinPatient=?, cinPraticien=?, dateHeure=?, statut=?, idRdvParent=? WHERE idRdv=?`,
    [cinPatient, cinPraticien, dateHeure, statut, idRdvParent, req.params.idRdv],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Rendez-vous mis à jour' });
    }
  );
});

// DELETE : Supprimer un rendez-vous
app.delete('/rendezvous/:idRdv', (req, res) => {
  db.run(`DELETE FROM rendezvous WHERE idRdv = ?`, [req.params.idRdv], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Rendez-vous supprimé' });
  });
});





// Route POST : Connexion utilisateur
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Utilisateur non trouvé' });
    if (!user.isApproved) return res.status(403).json({ error: 'Compte en attente de validation' });

    bcrypt.compare(password, user.password, (err, result) => {
      if (result) res.json({ message: 'Connexion réussie', user });
      else res.status(401).json({ error: 'Mot de passe incorrect' });
    });
  });
});

// Route POST : Inscription utilisateur (non validé)
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashed], function (err) {
    if (err) return res.status(400).json({ error: 'Utilisateur déjà existant' });
    res.json({ message: 'Compte créé. En attente de validation par un administrateur.' });
  });
});


// Route pour ajouter un admin
app.post('/admins', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email et mot de passe requis" });

  // Vérifier le nombre d'admins (max 3)
  db.get('SELECT COUNT(*) as count FROM admins', [], async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row.count >= 3)
      return res.status(400).json({ error: "Nombre maximum d'administrateurs atteint (3)" });

    // Vérifier si l'email existe déjà
    db.get('SELECT * FROM admins WHERE email = ?', [email], async (err, admin) => {
      if (admin) return res.status(400).json({ error: "Cet email existe déjà." });

      // Hash du mot de passe
      const hashed = await bcrypt.hash(password, 10);
      db.run(
        'INSERT INTO admins (email, password) VALUES (?, ?)',
        [email, hashed],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.status(201).json({ id: this.lastID, email });
        }
      );
    });
  });
});


// Route POST : Authentification admin
app.post('/admins/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM admins WHERE email = ?', [email], (err, admin) => {
    if (err || !admin) {
      return res.status(401).json({ error: "Admin non trouvé" });
    }
    // Vérifier le mot de passe hashé
    bcrypt.compare(password, admin.password, (err, result) => {
      if (result) {
        // Ici tu peux générer un token si tu veux (JWT, etc.)
        res.status(200).json({ message: "Connexion admin réussie", admin: { id: admin.id, email: admin.email } });
      } else {
        res.status(401).json({ error: "Mot de passe incorrect" });
      }
    });
  });
});


// --- Liste de tous les admins ---
app.get('/admins', (req, res) => {
  db.all('SELECT id, email FROM admins', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// --- Liste de tous les utilisateurs ---
app.get('/users', (req, res) => {
  db.all('SELECT id, email, isApproved FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


// Supprimer un administrateur par son id
app.delete('/admins/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM admins WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Admin non trouvé" });
    res.json({ message: "Admin supprimé" });
  });
});

// Supprimer un utilisateur par son id
app.delete('/users/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM users WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Utilisateur non trouvé" });
    res.json({ message: "Utilisateur supprimé" });
  });
});


// 📄 Lister toutes les consultations (inclut le prix)
app.get('/consultations', (req, res) => {
  db.all('SELECT * FROM consultations', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ➕ Ajouter une consultation (avec prix optionnel)
app.post('/consultations', (req, res) => {
  const { idRdv, dateConsult, compteRendu, prix } = req.body;

  const sql = `
    INSERT INTO consultations (idRdv, dateConsult, compteRendu, prix)
    VALUES (?, ?, ?, ?)
  `;

  db.run(sql, [idRdv, dateConsult || new Date().toISOString(), compteRendu || '', prix || null], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID });
  });
});

// ✏️ Modifier une consultation (prix modifiable)
app.put('/consultations/:idConsult', (req, res) => {
  const { idRdv, dateConsult, compteRendu, prix } = req.body;
  const { idConsult } = req.params;

  const sql = `
    UPDATE consultations
    SET idRdv = ?, dateConsult = ?, compteRendu = ?, prix = ?
    WHERE idConsult = ?
  `;

  db.run(sql, [idRdv, dateConsult, compteRendu, prix, idConsult], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Consultation non trouvée" });
    res.json({ modified: this.changes });
  });
});

// ❌ Supprimer une consultation
app.delete('/consultations/:idConsult', (req, res) => {
  db.run(`DELETE FROM consultations WHERE idConsult = ?`, [req.params.idConsult], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});


// 🔍 Recherche avancée (inchangée, mais renvoie aussi le prix)
app.get('/consultations/search', (req, res) => {
  const { patient, praticien, date, compteRendu } = req.query;

  let sql = `
    SELECT c.*, c.prix FROM consultations c
    LEFT JOIN rendezvous r ON c.idRdv = r.idRdv
    LEFT JOIN patients p ON r.cinPatient = p.cinPatient
    LEFT JOIN praticiens pr ON r.cinPraticien = pr.cinPraticien
    WHERE 1=1
  `;
  const params = [];

  if (patient) {
    sql += " AND (p.nom LIKE ? OR p.prenom LIKE ?)";
    params.push(`%${patient}%`, `%${patient}%`);
  }
  if (praticien) {
    sql += " AND (pr.nom LIKE ? OR pr.prenom LIKE ?)";
    params.push(`%${praticien}%`, `%${praticien}%`);
  }
  if (date) {
    sql += " AND date(c.dateConsult) = date(?)";
    params.push(date);
  }
  if (compteRendu) {
    sql += " AND c.compteRendu LIKE ?";
    params.push(`%${compteRendu}%`);
  }

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 📄 Lister toutes les prescriptions
app.get('/prescriptions', (req, res) => {
  db.all('SELECT * FROM prescriptions', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ➕ Ajouter une prescription
app.post('/prescriptions', (req, res) => {
  const { idConsult, typePrescrire, posologie, datePrescrire } = req.body;
  db.run(
    `INSERT INTO prescriptions (idConsult, typePrescrire, posologie, datePrescrire) VALUES (?, ?, ?, ?)`,
    [idConsult, typePrescrire, posologie, datePrescrire],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
});

// ✏️ Modifier une prescription
app.put('/prescriptions/:idPrescrire', (req, res) => {
  const { idConsult, typePrescrire, posologie, datePrescrire } = req.body;
  const { idPrescrire } = req.params;
  db.run(
    `UPDATE prescriptions SET idConsult=?, typePrescrire=?, posologie=?, datePrescrire=? WHERE idPrescrire=?`,
    [idConsult, typePrescrire, posologie, datePrescrire, idPrescrire],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ modified: this.changes });
    }
  );
});

// ❌ Supprimer une prescription
app.delete('/prescriptions/:idPrescrire', (req, res) => {
  db.run(`DELETE FROM prescriptions WHERE idPrescrire=?`, [req.params.idPrescrire], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});


// ...existing code...

// 📄 Lister tous les examens
app.get('/examens', (req, res) => {
  db.all('SELECT * FROM examen', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ➕ Ajouter un examen
app.post('/examens', (req, res) => {
  const { idConsult, typeExamen, dateExamen, resultat } = req.body;
  db.run(
    `INSERT INTO examen (idConsult, typeExamen, dateExamen, resultat) VALUES (?, ?, ?, ?)`,
    [idConsult, typeExamen, dateExamen, resultat],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
});

// ✏️ Modifier un examen
app.put('/examens/:idExamen', (req, res) => {
  const { idConsult, typeExamen, dateExamen, resultat } = req.body;
  const { idExamen } = req.params;
  db.run(
    `UPDATE examen SET idConsult=?, typeExamen=?, dateExamen=?, resultat=? WHERE idExamen=?`,
    [idConsult, typeExamen, dateExamen, resultat, idExamen],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ modified: this.changes });
    }
  );
});

// ❌ Supprimer un examen
app.delete('/examens/:idExamen', (req, res) => {
  db.run(`DELETE FROM examen WHERE idExamen=?`, [req.params.idExamen], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});



// Mettre à jour un rendez-vous et créer une consultation si confirmé
app.put('/rendezvous/:id', async (req, res) => {
  const { statut } = req.body;
  const idRdv = req.params.id;

  // Mettre à jour le rendez-vous
  await db.query('UPDATE rendezvous SET statut = ? WHERE idRdv = ?', [statut, idRdv]);

  // Si confirmé, ajouter dans consultations si pas déjà présent
  if (statut === 'confirme') {
    const [exists] = await db.query('SELECT * FROM consultations WHERE idRdv = ?', [idRdv]);
    if (exists.length === 0) {
      // Récupérer les infos du rendez-vous
      const [rdvRows] = await db.query('SELECT * FROM rendezvous WHERE idRdv = ?', [idRdv]);
      const rdv = rdvRows[0];
      if (rdv) {
        await db.query(
          'INSERT INTO consultations (idRdv, dateConsult, compteRendu) VALUES (?, ?, ?)',
          [rdv.idRdv, rdv.dateHeure, '']
        );
      }
    }
  }

  res.json({ message: 'Rendez-vous mis à jour' });
});


// ...existing code...
// Démarrer serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log('\nSERVEUR LANCÉ !\n');
  console.log('\x1b[32m%s\x1b[0m', `http://localhost:${PORT}`);                    // vert
  console.log('\x1b[36m%s\x1b[0m', `http://82.165.15.45:${PORT}`);               // cyan
  console.log('\x1b[35m%s\x1b[0m', `https://82.165.15.45      ← via Nginx HTTPS`); // magenta
  console.log('\n');
});

// Fermeture propre
process.on('SIGINT', () => {
  db.close(() => {
    console.log('Base fermée. Bye !');
    process.exit(0);
  });
});