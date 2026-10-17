# Cortex 4.1 — validation exécutée

16 octobre 2026. Branche locale `codex/cortex-v4.1-stabilization`, base `44fe889`. Les tests de modèle ci-dessous utilisent des réponses préparées ; **aucun benchmark `solar-bench run`, appel de génération Ornith, push, DMG ou installation** n'a été effectué. Les fixtures et validateurs officiels n'ont pas été modifiés.

## Commandes et résultats

| Contrôle | Commande / méthode | Résultat observé |
| --- | --- | --- |
| Build et typage | `npm run build` | Succès : `tsc -b` puis Vite, 5 506 modules transformés, ~13 s pour Vite. Avertissement Vite préexistant sur les chunks supérieurs à 500 kB ; aucun échec. |
| Rust natif | `cd src-tauri && cargo test --offline --lib` | 9 tests réussis, aucun échec ; inclut click/fill, chemins et liens symboliques, annulation, scripts protégés, copie isolée, build/réparation et aperçu natif. |
| Suites déterministes | `node --experimental-strip-types <fichier>` pour les 14 fichiers ci-dessous, en série | 14 suites terminées avec code 0 ; les assertions positives et négatives V4.1, les régressions V4/V3.3, WebKit et les contrats de Solar Bench passent. |
| Intégrité du patch | `git diff --check` | Aucune erreur de whitespace. |
| État du dépôt | `git status --short --branch` et comparaison SHA-256 des neuf fichiers sales avant travail | Branche locale dédiée ; aucune modification de ces neuf fichiers imputable à V4.1, aucun fichier préexistant effacé. |

Les 14 suites sont : `agent-contract`, `cortex-contract`, `cortex-efficiency`, `cortex-backend-efficiency`, `cortex-v4-1`, `cortex-v4-1-webkit`, `cortex-v4`, `cortex-patch-recovery`, `cortex-autonomous-repair`, `cortex-v3-3`, `cortex-v3-3-1`, `cortex-v3-3-1-regression`, `cortex-render`, `solar-bench-technical` (toutes dans `scripts/`, suffixe `.test.mjs`). La dernière suite inspecte les définitions et validateurs techniques de Solar Bench ; elle **n'exécute pas** les 25 benchmarks.

## Cas critiques réellement exercés

- Contrôle indépendant réussi face à auto-test modèle invalide ou hors domaine ; contrôle DOM indépendant réellement défaillant toujours détecté. Différence exacte entre texte du bouton, `value` d'un input, présence de l'attribut booléen `open`, visibilité et style ; click interdit avec valeur et fill interdit sur cible non éditable.
- Ouverture puis fermeture d'un composant vérifiées comme deux transitions distinctes dans un vrai moteur WebKit, avec états d'origine observés, échantillons de scale/opacité/flou, et respect de `prefers-reduced-motion`. Un scénario explicite à deux transitions est aussi passé par le runtime et le renderer natif, sans substitution de la baseline indépendante.
- Lot cohérent correction + no-op ; correction DOM + CSS ; rejet d'une action essentielle avec rollback complet ; conflit de source, garde hash, protections de fichiers et annulation. Édition de symboles CommonJS sûre ou repli sur plage gardée, et import CJS non résolu avec diagnostic précis.
- Cache de vérification réutilisé sur source et conditions identiques, invalidé par changement de source, dépendance ou configuration. Schéma local exact, HTML autonome fermé sans fence finale dans le seul protocole permis, HTML tronqué rejeté, contrainte du premier tour transmise au second.
- Refus de reprise avec identité modèle différente sans écraser le checkpoint ; mémoire historique conditionnée aux empreintes ; proposition marquée livrée avant complétion ; consentement cloud séparé par compte, dossier et endpoint. Huit cas de non-régression de Swift, JS, UI et animation passent dans la suite V3.3.1.

## Inspection de l'interface

L'aperçu de production Vite a été ouvert avec Playwright et Chromium sur des données synthétiques, un fournisseur local **simulé** et un dossier fictif. Deux demandes Solar Code successives ont produit deux tâches Cortex `4.1.0` en pause avec une proposition chacune ; la contrainte du premier tour était présente dans le second appel. La pause est attendue en navigateur : le compilateur natif nécessaire n'y est pas disponible et aucune écriture n'a été autorisée. Ce scénario valide le routage et la conservation de contexte, **pas la qualité d'un modèle**.

Contrôles observés : rendu clair et sombre, largeur de 600 px sans débordement horizontal, mouvement réduit activé, pièce jointe texte synthétique ajoutée puis supprimée, focus clavier visible, envoi d'un message avec réponse simulée, bouton Stop présent pendant l'attente puis retour à l'état d'envoi. Console de l'aperçu de production : 0 erreur, 0 avertissement lors du contrôle final. Captures : [sombre](../output/playwright/cortex-v4-1/dark-paused.png) et [clair](../output/playwright/cortex-v4-1/light-paused.png). Les palettes personnalisées exhaustives et l'application Tauri empaquetée n'ont pas été inspectées visuellement dans ce lot.

## Incidents rencontrés pendant les tests

- Le premier test temporel WebKit montrait un état de départ incorrect après la précondition. L'horloge d'une fenêtre WebKit hors écran n'avançait pas de façon fiable avec une attente murale. La précondition avance désormais seulement les animations WAAPI finies déjà créées par la page, puis remet le déclencheur final à son origine ; le test d'ouverture/fermeture passe. Les horloges JavaScript arbitraires restent non prises en charge.
- La validation stricte a révélé un opérateur de plage indisponible au tour de réparation et une restriction de conflit appliquée à tous les fichiers. Le schéma expose maintenant les opérateurs sûrs et restreint seulement le chemin en conflit ; les tests de garde et de réparation passent.
- La commande `playwright-cli` directe n'était pas exécutable et le navigateur Chrome par défaut était absent. Le wrapper a été lancé avec `bash` et un Chromium déjà installé ; aucun navigateur n'a été téléchargé. Le profil de développement Vite se réinitialisait pendant les changements de code ; l'inspection finale a utilisé l'aperçu de production stable.

## Non exécuté et portée des résultats

- Aucun test réel d'Ornith 1.5 9B, aucun des 25 benchmarks, aucune comparaison V4/V4.1 de durée, mémoire, réussite ou consommation de tokens. **Aucune accélération ni hausse du score n'est démontrée.**
- Pas de validation de transaction disque multi-fichier après crash, de sandbox macOS, de résolution complète des packages, de toutes les anciennes migrations de checkpoint, de monitoring continu RAM/swap ou de capture temporelle multi-transition d'un projet React réel.
- Les scénarios proposés par un modèle restent des conseils non indépendants : ils ne peuvent pas à eux seuls certifier ou faire échouer une solution. La conformité générale à des tâches inédites nécessite l'évaluation finale autorisée.

Le plan reproductible pour cette évaluation, **préparé sans exécution**, figure dans [CORTEX_V4_1_FINAL_BENCHMARK_PLAN.md](CORTEX_V4_1_FINAL_BENCHMARK_PLAN.md). Le statut de chaque point d'audit figure dans [CORTEX_V4_1_AUDIT_COVERAGE.md](CORTEX_V4_1_AUDIT_COVERAGE.md).
