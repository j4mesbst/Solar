# Audit d'équité

| Dimension | Règle |
|---|---|
| Modèle | même nom, digest et quantification vérifiés par doctor |
| Contexte | serveur dédié imposant 16K ; mesure `/api/ps`, pas simple intention de config |
| Sources | tous les fichiers publics de la fixture ; aucune information issue des oracles |
| Outils | méthodes natives autorisées, shell borné au dépôt temporaire |
| Validation | mêmes tests indépendants après le run |
| Ordre | rotation Cortex/Aider/OpenCode ; jamais simultanés |
| Répétitions | trois pour tous ; aucune sélection a posteriori du meilleur run |
| Cloud | clés non transmises, réseau limité à localhost, cloud Ollama désactivé |
| Intervention | zéro intervention pendant un essai autonome ; étude humaine séparée |

Aider reçoit explicitement tous les fichiers publics afin de ne pas être artificiellement privé de contexte ; son repo-map reste natif. OpenCode explore le même dépôt. Cortex reçoit la même liste publique. Les caches et historiques sont propres à chaque essai.

Limites : les architectures natives n'exposent pas les mêmes compteurs ; les tokens sont donc comparés seulement quand rapportés. Le sandbox macOS réduit l'accès au système mais n'est pas une VM. Les fixtures sont synthétiques et ne suffisent pas à conclure à une supériorité générale. La variante 04 avec supervision humaine demeure une étude séparée et ne compte pas dans le score autonome.
