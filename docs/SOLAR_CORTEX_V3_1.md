# Solar Cortex V3.1 — exécution locale persistante

Solar Cortex V3.1 garde `ornith-1.5:9b` comme seul modèle et ne contacte
aucun service distant. Il ne modifie jamais un projet sans la proposition puis
l’approbation déjà requises par Solar Code.

## Horizon de tâche

Les limites de `maxDurationMs`, d’étapes, de réparations et de candidats ne
sont plus appliquées à une tâche de production lorsqu’aucune limite explicite
n’est fournie. Les campagnes reproductibles passent toujours leurs propres
limites à `CortexRequest.limits` : elles restent donc comparables et bornées.

Chaque appel Ollama dispose toutefois d’un délai individuel configurable
(`generationTimeoutMs`, 120 s par défaut) pour ne pas laisser un processus
bloqué immobiliser Solar. Son expiration devient un checkpoint de réparation
avec une consigne plus atomique ; elle ne termine pas la tâche entière.

## État et reprise

Le checkpoint existant conserve l’objectif, le plan, les candidats, les
modifications mises en scène, les contrôles, les erreurs et les événements.
Il est enregistré après les changements utiles et périodiquement. La reprise
revalide le workspace et la version source avant toute continuation : aucun
changement utilisateur n’est écrasé. Après fermeture de Solar, une tâche
persistée peut être reprise ; aucun calcul ne prétend continuer pendant que
l’application ou macOS est suspendu.

## Progression et sûreté

Une tâche continue seulement lorsqu’elle apporte un changement, une nouvelle
erreur utile ou une stratégie atomique différente. Les signatures de contenu,
de diagnostics et de timeout détectent la stagnation. Les exports CommonJS/ES
sont vérifiés contre les déclarations locales avant les tests, ce qui évite un
faux progrès du type `module.exports = { clamp }` sans `clamp`.

Le contexte par appel reste à 8K par défaut (4K en mémoire basse) et la sortie
reste techniquement bornée, avec continuation JSON pour les résultats coupés.

## Modes et limites réelles

Fast, Balanced, Deep et Ultra contrôlent la stratégie de contexte, de
vérification et d’alternatives ; ils ne fixent plus la durée totale d’une tâche
de production. V3.1 n’altère pas les réglages globaux d’Ollama. Une tâche sans
plafond global n’est pas une boucle infinie : elle s’arrête sur annulation,
stagnation persistante, conflit de fichiers ou risque technique.

La surveillance continue swap/pression mémoire et la poursuite pendant la
veille macOS ne sont pas implémentées : elles ne sont pas simulées.
