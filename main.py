import threading
import time
from database_manager import init_db, ajouter_souvenir, recuperer_contexte

def sauvegarde_asynchrone(evenement, choix, humeur):
    """
    Exécute la sauvegarde dans un thread séparé pour ne pas bloquer l'interface principale.
    """
    thread = threading.Thread(target=ajouter_souvenir, args=(evenement, choix, humeur))
    thread.start()

def demarrer_jeu():
    # Initialisation de la base de données au démarrage
    init_db()
    
    print("=== NARRATEUR RENARD ET SPECTRE ===")
    
    # Récupération des 3 derniers événements
    contexte = recuperer_contexte(limite=3)
    
    if contexte:
        print("\nNarrateur : 'La dernière fois, nous en étions restés là...'")
        # On inverse la liste pour afficher chronologiquement (du plus ancien au plus récent des 3 derniers)
        for session in reversed(contexte):
            id_session, timestamp, evt, choix, humeur = session
            print(f" - [{timestamp}] Événement : {evt} | Choix : {choix} | Humeur du Renard : {humeur}")
    else:
        print("\nNarrateur : 'C'est le début d'une nouvelle aventure...'")
        
    print("\n--- Début de la session ---")
    
    # Boucle principale (simulation de l'interface utilisateur)
    while True:
        try:
            evenement = input("\nQue se passe-t-il ? (ou tapez 'quitter' pour arrêter) : ")
            if evenement.lower() in ['quitter', 'q', 'exit']:
                print("Narrateur : 'À bientôt pour la suite de nos aventures...'")
                break
                
            choix = input("Quel est votre choix ? : ")
            humeur = input("Quelle est l'humeur du Renard ? : ")
            
            # Remplacement de l'ancienne sauvegarde par ajouter_souvenir (de façon asynchrone)
            print("Narrateur : 'Je prends note de vos actions...'")
            sauvegarde_asynchrone(evenement, choix, humeur)
            
            # L'interface reste fluide, on peut continuer immédiatement
            print("L'aventure continue sans interruption !")
            
        except KeyboardInterrupt:
            print("\nNarrateur : 'À bientôt pour la suite de nos aventures...'")
            break

if __name__ == '__main__':
    demarrer_jeu()
