# Cortex V4.1 — Phase 1.3b : réparation structurelle du DOM

## Diagnostic confirmé avant modification

Source : `~/Library/Application Support/Solar/benchmarks/2026-10-16T21-12-57-997Z-5957c127/`, fichiers `BENCHMARK_RESULTS.json`, `ui-reference-cortex-checkpoint.json` et événements du checkpoint. Résultat historique : STAGNATION, 556 324 ms, 9 033 tokens de sortie, 16 générations dont quatre avis vision, sept réparations comptabilisées.

Le diagnostic « les éléments ne sont jamais créés » doit être nuancé : l’étape 11 obtient **11 vérifications réussies, zéro échec**, notamment le contrôle DOM, puis sa proposition est annulée. Le HTML initial ne contient que `aside`, `main` et une `div.chatbox role="button" tabindex="0"` ; un rôle ARIA ne transforme pas une div en élément natif. Le sélecteur `textarea,input,button` du validateur signifie une alternative CSS : au moins un de ces éléments. Il n’impose pas trois éléments distincts. Aucun changement du validateur n’est nécessaire ni effectué.

Les sept incréments du compteur se reconstituent ainsi à partir des événements, des vérifications, des huit dernières traces et des branches du runtime qui incrémentent `repairs` :

| Compteur | Étape | Action et fichier | Résultat effectif |
| --- | --- | --- | --- |
| 1 | 1 | `replaceFile`, `index.html` : document vide → premier artefact `8b9eb005` | Structure visuelle présente, mais contrôle natif manquant. Le compteur inclut cet échec initial. |
| 2 | 3 | Contrôle inchangé sur `index.html`, résultat réutilisé du cache | Même source et même défaut. Le type exact n’est plus archivé ; le chemin de comptage correspond à `runCheck` ou `finish` sans mutation. |
| 3 | 6 | `runCheck`, aucune édition | Même défaut ; faux signal de régression dû au changement des paramètres d’inspection. |
| 4 | 7 | `patchFile`, `index.html` | Texte ancien absent de la source `8b9eb005` : patch rejeté, aucune mutation conservée. |
| 5 | 10 | Continuation du JSON tronqué à l’étape 9 | JSON invalide, aucune édition appliquée. Étape 9 : 2 200 tokens ; étape 10 : 2 130 tokens supplémentaires. |
| 6 | 11 | `replaceRange`, `index.html`, source vérifiée SHA-256 `27d381f5c77ebf0447cb112069a37116083d7379e7af719089fcc136e17d4142` | Les onze contrôles passent, y compris le DOM ; CEGIS restaure pourtant `8b9eb005`. |
| 7 | 12 | `runCheck`, aucune édition, branche de recherche | Le premier artefact restauré échoue encore au DOM ; arrêt anti-stagnation. |

Opérations intermédiaires déterminantes : étape 4, `readFile(index.html)` ; étape 5, `inspectUI(index.html)`, sans édition, qui ajoute un viewport `1280×1080` ; étape 8, deux `readFileRange(index.html)` donnant seulement les lignes CSS 10 (`body {`) et 20 (`background: #d1d5db`). Les étapes 1–3 sont sorties de la fenêtre des huit traces. Les réponses brutes ont été remplacées par longueur et empreinte : le texte exact du patch rejeté et celui de la réparation réussie puis annulée ne sont pas récupérables. Aucun contenu intermédiaire n’est inventé dans ce rapport.

## Causes racines et emplacements

1. **Annulation d’une réparation valide.** L’ancien `inspectUI` modifiait `request.inspection` dans `runtime.ts` (bloc actuel autour de 753). `experience.ts:8–12` inclut ces paramètres dans `comparisonKey` ; `evidence.ts:14–17` considère l’absence d’une ancienne clé comme une régression. Les clés passent de `d9b51ddd` à `285a87b9`. Le bloc de restauration de `runtime.ts` (autour de 312) restaure alors la candidate initiale, même lorsque les mêmes contrôles logiques passent dans le nouveau scénario. Ces règles de comparaison ne sont pas assouplies : c’est la modification du scénario indépendant par le modèle qui est supprimée.
2. **Priorité structurelle seulement verbale.** L’ancien `repair.ts` reconnaissait déjà `DOM requis` et demandait HTML avant CSS, mais le schéma du runtime réintroduisait `runCheck`, `finish`, `inspectUI` et les outils CSS dans une réparation. Le modèle pouvait donc consommer plusieurs générations sans édition. Les avis vision restaient sollicités et ajoutés à un défaut structurel bloquant ; le dernier avis demandait même du contenu décoratif dans `main`.
3. **Source utile insuffisamment protégée.** Le remplacement du contexte par `sourceReads` dans `runtime.ts` (autour de 470) pouvait ne transmettre que les lectures des lignes CSS. Le diagnostic ne fournissait ni insertion HTML numérotée ni obligation structurée complète. Le parsing historique tronquait aussi les sélecteurs au premier point ou point-virgule et ne reconnaissait pas tous les diagnostics JSON `found:false`.
4. **Progression et restauration.** La mémoire ne distinguait pas une amélioration de pixels d’une correction DOM ; une restauration rétablissait l’ancienne mémoire et perdait l’essai sans progrès. La signature de stagnation finit par arrêter la boucle, mais seulement après plusieurs contrôles, un conflit et une longue continuation inutile.

Il est confirmé qu’Ornith a demandé des lectures CSS sans rapport direct avec la cible manquante. Il n’est pas démontré qu’il n’a proposé que du CSS : les contenus bruts manquent et la réparation de l’étape 11 a réellement satisfait le contrôle DOM.

## Modifications

- `src/lib/cortex/dom-repair.ts` : adaptation des diagnostics mesurés en sélecteurs/attentes/fichiers, conservation des listes CSS alternatives, extraits HTML à partir de `body` et JSX autour du rendu, lignes originales et hash courant. Les zones omises sont explicites et restent lisibles par les outils existants.
- `src/lib/cortex/repair.ts` : priorité de toutes les absences DOM reconnues avant le style ; attributs et attentes disponibles sans inventer d’exigences ; comparaison des défauts DOM avant/après. Une amélioration visuelle seule ne réinitialise plus la stagnation structurelle ; réévaluation dès le premier essai sans progrès DOM.
- `src/lib/cortex/runtime.ts` : schéma structurel centré sur lecture ciblée et édition par plage gardée ; source structurelle requise dans le Context Engine, indépendante des anciennes lectures CSS ; avis vision différés tant que la cible manque ; captures exploratoires distinctes des paramètres de vérification indépendants ; essais restaurés conservés dans la mémoire.
- `src/lib/cortex/semantic.ts` : détection AST des changements JSX limités aux attributs de présentation, complément du garde-fou CSS HTML existant. Aucun élément attendu n’est injecté par Cortex.
- `src/lib/cortex/types.ts` : mémoire optionnelle des défauts DOM, compatible avec les anciens checkpoints.

Les mécanismes restent généraux : aucun nom de fixture ni liste de contrôles HTML attendus n’est codé dans la réparation. Les tests utilisent aussi `select`, `option` et `dialog`, des attributs, des sélecteurs avec points et des branches non rendues. Les validateurs existants fournissent seuls les verdicts de réussite.

## Vérifications

Réussites : nouveau `scripts/cortex-dom-repair.test.mjs` (HTML et React réellement rendus, attribut attendu, template et branche conditionnelle non rendus, modification inerte, CSS rejeté, rollback, progression, paramètres indépendants stables), `cortex-context-recovery`, `cortex-multifile-repair`, `cortex-first-artifact`, `cortex-backend-efficiency`, `cortex-contract`, `cortex-pre-v5`, `cortex-v4-1`, `cortex-read-symbol`, `cortex-autonomous-repair`, `cortex-pre-v5-webkit`, `cortex-v4-1-webkit`. Build TypeScript/Vite réussi ; avertissement préexistant de chunks supérieurs à 500 kB. `git diff --check` réussi.

Échecs préexistants, reproduits en exécutant les tests actuels contre le snapshot source historique `solar-bench-cortex-Cc8xnz/snapshot` :

- `scripts/cortex-efficiency.test.mjs:29` : le schéma de reprise après conflit d’un fichier rejette aussi l’édition d’un autre fichier du même lot ; résultat `paused` au lieu de `completed`.
- `scripts/cortex-patch-recovery.test.mjs:59` : le schéma rejette l’action avant que l’ancien test n’obtienne le message « déjà rejeté » attendu.

Ces échecs ne sont pas masqués par une modification de leurs assertions. Les tests actuels V4.1 et multi-fichiers passent, mais la totalité des anciens contrats de rollback n’est donc pas verte. Autre limite observée, hors modification : le validateur statique existant produit un faux positif sur `export default function App`; le test React de réparation utilise l’export de l’identifiant d’un composant fléché, compilé et rendu réellement. Aucun validateur n’est modifié.

## Benchmark réel unique

Commande : `npm run solar-bench -- run --fixture ui-reference --model ornith-1.5:9b --variant cortex`.

**PASS**, 69 318 ms (1 min 9,318 s), **679 tokens de sortie**, 10 399 tokens d’entrée, cinq générations dont un avis vision, **zéro réparation**, aucune régression enregistrée, aucune réutilisation d’un résultat de campagne. Les six contrôles indépendants passent : capture WebKit, navigation, contrôle HTML natif, débordement, largeur de sidebar et différence avec la référence (0,042 ≤ 0,14).

Rapport réel : `~/Library/Application Support/Solar/benchmarks/2026-10-16T21-32-59-557Z-ca1bd1de/BENCHMARK_REPORT.md`.

Le premier artefact d’Ornith contient un vrai `button`. La boucle de réparation structurelle n’a donc pas été exercée par ce benchmark ; elle l’est par les tests déterministes HTML/React avec WebKit réel. Le benchmark exerce bien `inspectUI` après la première validation, sans changement de l’identité des contrôles ni annulation. L’évolution visuelle facultative poursuit trois tours (`runCheck`, lecture, inspection), puis conserve honnêtement la meilleure version vérifiée ; ce reliquat de générations d’optimisation existe toujours. Ce PASS ciblé unique ne prouve ni la répétabilité des inférences Ornith ni un score de régression 8/8. Aucune seconde exécution n’a été lancée.

Les SHA-256 des cinq fichiers source touchés ont été comparés à ceux du snapshot de la campagne : ils sont identiques au code final. Aucun benchmark ni validateur n’a été modifié pendant cette intervention. Les modifications locales antérieures, notamment celles de `src/lib/agent/verification.ts`, ont été conservées.

## Inspection de l’application

La skill Playwright a été utilisée avec un profil isolé et le Chromium de test déjà installé. Le wrapper n’étant pas exécutable directement, il a été lancé via Bash ; le Chrome système est absent, donc un fichier de configuration pointe vers le Chromium existant. L’application a été ouverte, son onboarding facultatif fermé et une capture inspectée (`output/playwright/cortex-dom-app.png`). La seule erreur console du chargement CLI est le favicon absent (404).

Le test existant `scripts/ui-cortex.cjs`, avec fournisseur simulé et aucun appel supplémentaire à Ornith, a validé le chat, une pièce jointe, la copie de commande, les vues sombre/claire et le réglage de mémoire. Les captures chat et paramètres ont été inspectées. Il échoue ensuite par timeout sur le résumé « Vérifications Cortex » après l’apparition de « Reprendre Cortex » : la fin de ce parcours UI n’est pas validée et ses assertions ne sont pas modifiées. Les tests de runtime et le benchmark natif ci-dessus restent distincts de cet échec UI.

Contrôle CLI supplémentaire à 600×760 avec mouvement réduit et Tab : capture inspectée, focus visible sur la commande de sidebar, composer et contrôles visibles, envoi désactivé sans modèle (`output/playwright/cortex-dom-small.png`). Le navigateur de test et le serveur Vite démarrés pour cette inspection ont été fermés.

Aucun commit ni push.
