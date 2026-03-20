import sqlite3

def init_db():
    """
    Initialise la base de données SQLite 'res_memory.db' et crée la table 'sessions'
    si elle n'existe pas déjà.
    """
    # Connexion à la base de données (le fichier sera créé s'il n'existe pas)
    conn = sqlite3.connect('res_memory.db')
    cursor = conn.cursor()

    # Création de la table avec la clause IF NOT EXISTS
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            evenement TEXT,
            choix_joueur TEXT,
            humeur_renard TEXT
        )
    ''')

    # Sauvegarde (commit) des modifications et fermeture de la connexion
    conn.commit()
    conn.close()

def ajouter_souvenir(evenement, choix, humeur):
    """
    Insère un nouveau souvenir dans la table sessions.
    Utilise des requêtes préparées pour la sécurité.
    """
    conn = sqlite3.connect('res_memory.db')
    try:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO sessions (evenement, choix_joueur, humeur_renard)
            VALUES (?, ?, ?)
        ''', (evenement, choix, humeur))
        conn.commit()
    finally:
        conn.close()

def recuperer_contexte(limite=5):
    """
    Récupère les derniers événements enregistrés, du plus récent au plus ancien.
    """
    conn = sqlite3.connect('res_memory.db')
    try:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, timestamp, evenement, choix_joueur, humeur_renard
            FROM sessions
            ORDER BY timestamp DESC
            LIMIT ?
        ''', (limite,))
        return cursor.fetchall()
    finally:
        conn.close()

if __name__ == '__main__':
    init_db()
    print("Base de données 'res_memory.db' et table 'sessions' initialisées avec succès.")
