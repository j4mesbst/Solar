# Solar Cortex V3.2 — performance mesurée

V3.2 remplace l’attente d’une solution complète par un chemin « First Working Artifact » : pour une tâche visuelle, Cortex demande directement une mutation compacte, la vérifie, puis répare à partir des diagnostics réels. La planification générée par le modèle est évitée pour ces tâches.

## Changements réellement connectés

- Cortex utilise le modèle Ollama sélectionné dans Solar. Ornith 1.5 9B reste la référence du benchmark, mais le runtime n’impose plus son identifiant.
- Le backend adapte toujours l’usage des outils et de la vision aux capacités déclarées par Ollama. Le mode JSON structuré reste le repli lorsque les appels d’outils sont incompatibles.
- Le timeout d’appel est devenu un timeout d’inactivité : chaque fragment du flux réarme le watchdog. Une génération active n’est donc plus interrompue par une durée fixe.
- Le premier artefact visuel contourne la planification LLM et exige une mutation atomique compacte. Une sortie visuelle tronquée est reconstruite en unité plus courte au lieu de concaténer aveuglément deux objets JSON.
- Chaque mutation est immédiatement soumise aux vérifications disponibles.
- Si WebKit mesure un document statique pour une demande d’animation, Cortex ajoute une entrée CSS bornée et compatible `prefers-reduced-motion`, puis recapture la séquence sans régénérer l’interface.
- La critique vision reste informative. Seules les mesures WebKit, les builds et les tests déterminent la réussite.
- La télémétrie persistante enregistre le premier artefact, la première vérification, les tokens, le cache de prompt, l’inférence, les actions, réparations, checkpoints, boucles et temps par phase. Les métriques absentes restent absentes.

## Sécurité

Les modifications demeurent des propositions. Les chemins, secrets, commandes arbitraires et écritures hors projet restent refusés. Le runtime conserve l’annulation utilisateur, les checkpoints et l’arrêt sur stagnation répétée.

## Limites constatées

Ornith reste très variable sur les gros documents JSON échappés. `ui-description` et `react-premium` n’ont pas convergé dans la fenêtre externe du benchmark. La réparation temporelle fonctionne sur `motion-simple`, mais ne garantit pas une animation interactive complexe conforme. Le rendu Vite compilé est validé par le build ; le banc actuel ne réinjecte pas encore proprement ses assets dans l’aperçu WebKit autonome.
