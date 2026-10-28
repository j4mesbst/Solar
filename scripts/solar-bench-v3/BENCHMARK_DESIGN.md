# Conception du benchmark

## Question et protocole

V3 mesure le travail vérifié, pas l'éloquence du rapport. Les trois agents reçoivent le même prompt public, le même dépôt initial, les mêmes dépendances et le même Ornith. Chaque harnais conserve sa méthode native. PASS exige tous les contrôles publics et privés ; les statuts `FUNCTIONAL_FAIL`, `REGRESSION`, `STAGNATION`, `TIMEOUT`, `CONTEXT_INSUFFICIENT`, `AGENT_MODEL_INCOMPATIBLE`, `INFRASTRUCTURE_ERROR` et `VALIDATION_UNAVAILABLE` restent distincts.

STRICT utilise 16K, sortie 2 200 tokens, température 0 et 8 minutes. PRACTICAL utilise 16K, sortie 4 096 et 12 minutes. Sur ce Mac 16 Go, 16K est le plus petit contexte commun plausible observé pour OpenCode ; 8K échoue en compaction. Les profils ne doivent pas être mélangés dans un rapport.

## Douze tâches fixes

1. récupération React cassée ; 2. refactor multifichier ; 3. fonctionnalité multicouche ; 4. tâche phasée ; 5. réparation sans régression ; 6. diagnostic vers correction ; 7. contexte et logs ; 8. API documentée locale ; 9. interface responsive ; 10. continuité longue ; 11. sortie de boucle d'outils ; 12. projet multilingue.

Le pilote fixe 01, 02, 06 et 10. Une première répétition des trois agents précède les deux suivantes. Une incompatibilité d'infrastructure arrête le pilote avant les répétitions 2–3. Le full alterne l'ordre des agents et comporte 108 essais.

## Isolation et preuves

Chaque essai matérialise un dépôt Git temporaire. Le sandbox macOS refuse par défaut, autorise seulement localhost, les fichiers système/outils nécessaires et les écritures sous workspace/state temporaire. Les validateurs privés restent dans V3 et ne sont pas lisibles depuis le sandbox candidat. La source Cortex de production est hachée avant/après chaque essai. Le snapshot immuable Cortex est vérifié lors d'une reprise.

Les 12 fixtures ont deux preuves déterministes : l'état initial est rejeté et la solution de référence est acceptée. Le validateur examine les comportements (résultats, immutabilité, exports, contraintes), pas seulement des mots. La tâche UI ajoute des contrats de structure, responsive, thème et mouvement réduit ; une future campagne visuelle secondaire pourra ajouter WebKit sans convertir l'esthétique en succès fonctionnel.

## Métriques

Durée, fichiers modifiés, checks, tokens rapportés, générations/réparations disponibles, RSS agent, mémoire modèle Ollama, swap et contexte effectif. Provenance directe/parsée/indisponible est conservée. Les métriques absentes ne valent jamais zéro.
