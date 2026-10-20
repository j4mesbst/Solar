# Solar Agent — MVP expérimental (lecture seule)

Cette branche ajoute une vue **Solar Agent** à la navigation native, sans créer un second moteur d'inférence.

## Parcours de test

1. Configurer au moins un modèle (Ollama local ou fournisseur avec sa clé API) dans Solar.
2. Dans **Plugins**, connecter GitHub avec un jeton à accès limité (`Contents: Read`) ou Gmail avec une autorisation OAuth **lecture seule**.
3. Ouvrir **Solar Agent**, choisir Gmail ou GitHub, rechercher des éléments, puis cocher explicitement jusqu'à cinq résultats.
4. Saisir une demande telle que « Résume ces courriels et prépare une réponse à relire », choisir un modèle et l'envoyer.
5. Vérifier que Solar Agent cite ou synthétise uniquement le contexte sélectionné, ne prétend pas avoir envoyé/modifié un élément, et affiche les erreurs d'autorisation.

## Limites intentionnelles

- **Pas encore d'agent autonome** : ce prototype est un assistant conversationnel avec contexte connecté fourni explicitement, sans planification multi-étapes ni boucle d'outils Cortex. Aucun envoi, archivage, classement d'e-mail, création de commit ou de PR n'est implémenté.
- Gmail fonctionne via OAuth Google dans le navigateur configuré ; sur macOS, la connexion Google native « un clic » n'est pas encore réalisée. Le mécanisme existant accepte un jeton temporaire avancé. Le token Gmail est uniquement en mémoire et expirera.
- GitHub lit une liste de dépôts et leur README ; les fichiers arbitraires, issues, commits et PR ne sont pas encore accessibles par ce prototype.
- Les requêtes sélectionnées peuvent être transmises à un **fournisseur externe** si un modèle cloud est utilisé. Pour rester local, choisir Ollama.
- Les conversations Agent sont volatiles dans ce MVP : pas de mémoire persistante, d'exécution différée, de tâches planifiées ni de synchronisation.
- Les sources sont traitées comme des données non fiables ; les instructions contenues dans leurs textes ne doivent pas être suivies. Il faudra tester explicitement les attaques par prompt injection sur plusieurs modèles.
- Aucun modèle gratuit, crédit cloud ou nouvel abonnement n'a été ajouté.

## Suite proposée — uniquement après les tests

1. Authentification Google native PKCE et revue des portées OAuth/Google.
2. Couche outil avec permissions par action, approbation explicite de **chaque écriture**, journal d'audit et possibilités d'annulation.
3. Intégration de la boucle Cortex **réelle**, capacités modèle vérifiées et récupération après échec ; ne pas simuler de réussite.
4. Tests d'intégration sur Gmail et GitHub de test, avec comptes/dépôts dédiés ; jamais sur des données privées de production lors des premiers essais.
5. Validation de valeur avec des utilisateurs avant toute tarification ou développement supplémentaire.

## Vérification

`npm ci && npm run build && npm run test:features && npm run test:ui:connections`

Les tests réseau simulés ne remplacent pas l'essai sur macOS avec un vrai compte Google, un dépôt GitHub de test et un modèle configuré.
