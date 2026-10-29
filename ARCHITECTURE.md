# Architecture — Solar 0.15.3

Solar associe une interface React/TypeScript à un hôte Tauri 2 pour macOS et Windows.

- `src/ui/AgentApp.tsx` : équipe, navigation, conversations montées et réglages.
- `src/components/team/` : profils, mascottes, managers, bibliothèque, modèles et intégrations.
- `src/components/atlas/` : conversation, rendu progressif, questions et événements d’outils.
- `src/services/solarAgentStore.ts` : identités, missions, profils, autorisations et dossiers par compte. Le retrait d’un profil conserve ses données et désactive son exécution.
- `src/services/solarAgentRuntime.ts` et le moteur Cortex : exécution bornée, permissions, outils, vérification des résultats et reprise des missions.
- `src/services/store.ts` et `storageCore.ts` : conversations, paramètres et sauvegardes atomiques.
- `src/services/teamCloud.ts` : résolution du choix de modèle persistant, sans repli caché.
- `src-tauri/src/` : stockage de secrets, fichiers, voix, Ollama, cycle de vie et commandes natives. Sur macOS, local_vault.rs conserve les secrets dans un fichier AES-256-GCM (nonce aléatoire, AAD du service, fichier 0600 et dossier 0700), avec clé aléatoire de 256 bits dans le Trousseau lue une fois par session. Mutex et flock sérialisent les accès ; sauvegarde par remplacement atomique. Migration à la lecture des anciennes entrées, conservées pour récupération ; tombstones pour les suppressions applicatives. Un refus bloque les nouvelles demandes de la session. Windows conserve Credential Manager et son cache de session.

Les services distants demandent une configuration explicite. Les états de connexion, d’outil et de résultat proviennent du moteur, pas d’une animation simulée. Une sélection de dossier conserve son inventaire dans la bibliothèque ; elle ne déclenche pas une lecture de contenu ou un envoi au cloud.

Les tests de contrat couvrent stockage, autorisations, fournisseurs, exports et exécution durable. `scripts/ui-messenger.cjs` utilise des données et réponses synthétiques pour vérifier les interactions. Une capture de ce parcours ne prouve pas une connexion externe réelle.
