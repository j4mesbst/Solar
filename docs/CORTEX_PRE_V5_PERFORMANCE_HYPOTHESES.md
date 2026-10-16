# Stabilisation avant V5 — hypothèses de performance

**Aucun gain d’inférence ou de score mesuré. Aucun benchmark complet avant Cortex V5.** Cette consigne remplace le plan de campagne préparé pour V4.1. Les tests de ce lot sont déterministes ; pas de génération réelle en arrière-plan.

| Hypothèse | Observation technique disponible | Mesure future nécessaire |
| --- | --- | --- |
| Moins de contexte redondant | Déduplication et sélection testées, état compact, grammaire DOM séparée, fitting 4K conservateur | Sur une même tâche synthétique : taille textuelle sérialisée, tokens de prompt réellement retournés, durée de prompt et réussite. Ne pas comparer seulement des caractères. |
| Meilleure réutilisation de préfixe | Système identique entre réparations dans le test ; données variables retirées du système | Même modèle/digest/configuration et état chaud documenté ; `prompt_eval_cached_count` si réellement renvoyé, sinon « non mesuré ». Un texte identique ne prouve pas un cache KV. |
| Moins de générations inutiles | Panne temporaire simulée : 1 génération, 2 essais de vérification ; répétition d’entrées détectée | Nombre d’appels par rôle, changements utiles et réussite d’une tâche réelle. La pause sur stagnation peut économiser des appels tout en nécessitant une intervention humaine. |
| Réparations plus ciblées | Original de diagnostic récupéré puis correction vérifiée dans un scénario préparé | Task indépendante avec erreur réelle, réparations et relectures utiles, qualité finale. La capacité d’un petit modèle à demander la bonne référence reste à vérifier. |
| Readiness plus fiable | React réel différé observe l’état attendu ; cible absente reste en échec | Variété de composants et temps réels d’observation. La garde locale peut ajouter du temps en cas d’attente impossible. |
| Invalidation plus sûre | Sources et environnement comparés avant/après, cache refusé si dérive | Coût supplémentaire des lectures/empreintes sur grand projet. Il peut augmenter le temps de vérification ; aucune accélération globale présumée. |
| Reprise et mémoire plus pertinentes | Contraintes/archives conservées, identité modèle et versions de contrôles prises en compte | Tâches interrompues réelles et changements de dépendances ; mesurer le travail repris sans répétition et les informations historiques effectivement utiles. |

Avant V5, une évaluation réelle ne serait justifiée que pour une correction précise que les tests déterministes ne peuvent établir. Choisir alors un scénario minimal isolé, critère indépendant défini avant génération, modèle utilisateur inchangé, coût/durée/périmètre archivés et arrêt dès vérification ou stagnation. Aucun mini-benchmark n’a été jugé nécessaire dans ce lot et aucune commande de campagne n’est proposée ici.

Après V5 et autorisation correspondante, une comparaison contrôlée devra archiver les sources exactes du runtime et des validateurs, le modèle/digest/quantification, contexte, machine et conditions de cache. Reporter succès/échecs/pauses, appels, tokens observés ou absents, temps par opération, contrôles réellement exécutés/réutilisés et mémoire mesurée. Ne jamais agréger un résultat ciblé comme un score des 25 exercices ni comparer des snapshots de code différents sans le signaler.
