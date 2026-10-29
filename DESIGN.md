# Solar 0.13.2 — contrat d’interface

Solar est une messagerie d’agents macOS. Préserver le mot Solar, la typographie native, les thèmes clair/sombre/personnalisé, les conversations, brouillons, pièces jointes et le comportement réel des fournisseurs et du stockage.

- Barre latérale de 272 px. Managers regroupés et centrés, marges égales pour un ou plusieurs profils. Bleu Messages uniquement pour le manager sélectionné. Réorganisation, promotion et retrait par glisser-déposer ; cible supplémentaire uniquement pendant un déplacement. Navigation clavier conservée.
- Clic droit : Supprimer l’agent retire son profil de l’équipe, désactive agent et routines, conserve son historique. Annuler le restaure sans réactiver les routines. Refuser le retrait pendant une mission active.
- Mascottes : cinq silhouettes, deux yeux blancs, couleur indépendante et animations distinctes. Couleur puis Forme centrées dans l’identité. Réduire ou arrêter les mouvements selon les préférences système et la visibilité.
- Conversation : bulles courtes successives sur les nouvelles réponses ; historique immédiatement lisible, livrables détaillés conservés. Couleur des messages utilisateur liée au profil. Choix multiples contextuels dans le fil, aucun bouton de suggestion sous le chat. Une reprise après absence ne prétend pas avoir travaillé en arrière-plan.
- Les phases affichées reflètent des opérations réelles, jamais un journal de réflexion privée. Le connecteur réellement exécuté est nommé avec le shimmer d’attente.
- Panneau agent : conserver les onglets et boutons actuels. Détails contient seulement Autorisations et trois choix pleine largeur. Bibliothèque affiche les dossiers explicitement ajoutés, sans transfert automatique. Ordinateur affiche Ton navigateur Solar et Bientôt.
- Modèles : trois cartes Local/Détecter, clé OpenAI personnelle, Solar Cloud selon configuration réelle. Aucune bascule silencieuse ni clé privée distribuée. Utilisation présente des statistiques mesurées.
- Clés dans le Trousseau, cache de session dédupliqué sans désactiver la sécurité macOS. Les plugins non implémentés ne sont pas annoncés comme connectés.

Avant une livraison, vérifier les états désactivés et erreur, clair/sombre/personnalisé, petite fenêtre, clavier/focus, mouvement réduit, pièces jointes et génération en cours. Mettre à jour PROGRESS.md avec les preuves et limites. Ne publier aucun secret, conversation privée ou artefact de test utilisateur.


## Finition 0.13.4

Chat clair #fcfcfc, sidebar #f5f5f5 ; sombre #121212 et #0e0e0e. Managers sélectionnés sur gris neutre ; palettes personnalisées prioritaires. Zone de déplacement supérieure, boutons natifs à 10 px des bords. QCM contextuels et réponses limitées à trois bulles, sans perte des livrables structurés.


## 0.14.0 — Windows et macOS

Même interface Windows, boutons et barre de titre natifs, clés Windows Credential Manager, OAuth navigateur et Ollama locaux, capture micro explicite. macOS : marges de 20 points logiques, espacement natif. Publication Windows après compilation, tests et démarrage natif ; microphone et connexions personnelles à vérifier sur matériel réel. Aucun accès développeur dans les builds publics.

## 0.15.0 — connexions et commandes de compte

Le clic Connecter démarre le navigateur OAuth sans étape promotionnelle ; clés API et comptes déjà connectés gardent leurs réglages. Retour navigateur noir sobre, texte centré, succès affiché uniquement après échange du jeton, contrôle d’identité et sauvegarde. Lien Retourner à Solar focalise la vraie fenêtre.

Profil : petit rond avec icône de compte, prénom, bouton rond Plugins indépendant. Menu vertical en lignes, icônes à gauche, chevrons à droite, séparation avant déconnexion. Icônes User et Blocks animées au survol, mouvement réduit respecté. Retrait du dégradé supérieur qui barrait les messages.

MAJ bleu Messages avant Rechercher, mêmes dimensions et espacements. Visible uniquement pour une version stable publique plus récente avec installateur adapté et SHA-256 disponible. Clic : téléchargement depuis le seul dépôt Solar, vérification de l’empreinte, installation et réouverture ; attente pendant les tâches. Préserver données et clés. Mac lancé depuis un DMG doit d’abord être installé dans Applications.

Ouverture : logo Solar existant, fond blanc et moteur de verre fourni (shader MIT Zanwei), ressort, dispersion et passage de lumière, une seule lecture. Pas de boucle ; mouvement réduit saute la scène et erreur graphique ne bloque pas l’app. Nettoyer le canvas et les ressources à la fin.
