export interface SkillTask { text: string; workMode?: boolean; artifact?: boolean; attachments?: boolean }
export interface BuiltinSkill { id: string; name: string; description: string; content: string; matches: (task: SkillTask) => boolean }
export const builtinSkills: BuiltinSkill[] = [
 {id:"solar:artifact-pro",name:"Artefact Pro",description:"Des présentations et interfaces avec une vraie hiérarchie visuelle.",matches:t=>Boolean(t.artifact),content:`# Artefact Pro

## Contrat de livraison
Produis le contenu final sous forme de fichier structuré solar-artifact, jamais un faux lien de téléchargement. Solar génère réellement le PPTX, DOCX, XLSX ou SVG correspondant.

## Présentations visuelles
Chaque diaporama doit raconter une progression : ouverture, idées principales, mécanisme, synthèse. Une idée forte par slide. Titres de 3–8 mots et descriptions brèves. Alterne les layouts suivants, qui deviennent des éléments natifs éditables dans le PowerPoint :
- cards : 2 à 6 cartes conceptuelles, label et detail.
- process : 2 à 6 étapes ordonnées, label et detail.
- metrics : label, display (chiffre avec unité), detail ; seulement des données fournies.
- chart : label et value numérique pour chaque catégorie, unit facultative ; exclusivement les chiffres de la source.

Exemple concret de structure (à adapter au sujet) :
\`\`\`json
{"kind":"slides","title":"Énergie solaire","slides":[{"title":"Comment fonctionne un panneau","body":"La lumière devient une énergie utilisable.","visual":{"type":"process","items":[{"label":"Capter","detail":"Les cellules reçoivent la lumière."},{"label":"Convertir","detail":"Le courant continu est produit."},{"label":"Distribuer","detail":"Un onduleur alimente les appareils."}]}}]}
\`\`\`

Utilise au moins une slide avec un visuel explicatif si la demande implique plusieurs slides. Ne crée pas de métriques fictives pour décorer. Les cartes et les étapes fonctionnent sans chiffres. Garde les labels sous 60 caractères et les détails courts, idéalement sous 120 caractères. N’utilise aucun SVG brut, image distante ou schéma non pris en charge. La couverture peut rester sans visual.

## Vérification avant livraison
JSON valide, aucun commentaire ; nombre exact de slides ; noms et chiffres fidèles ; pas de répétitions ; une synthèse utile ; chaque slide lisible avec son titre et sa propre idée. Pour HTML, vérifie navigation clavier, responsive, contraste et reduced-motion. Pour les autres artefacts, respecte leurs formats existants.

Pour cet artefact, compose un résultat prêt à utiliser. Respecte strictement le schéma solar-artifact et le format demandé, sans remplacer le fichier par du Markdown. Définis une palette sobre cohérente, une grille, des marges généreuses, une échelle typographique et un contraste lisible. Pour un diaporama : une idée principale par slide, titres précis, texte court, alternance introduction/explication/synthèse, sans surcharge. Pour HTML : composants sémantiques, états de boutons, navigation clavier, responsive et mouvement réduit. Choisis tableaux, encadrés et visualisations quand ils expliquent les données fournies. Évite tout texte tronqué, débordement et élément décoratif gratuit. N'invente ni chiffre ni asset inexistant. Vérifie en interne structure et cohérence avant de rendre le résultat.`},
 {id:"solar:code-max",name:"Code Max",description:"Code maintenable, revue des risques et vérifications ciblées.",matches:t=>Boolean(t.workMode)||/code|fonction|bug|react|typescript|python|programm|débog|debug/i.test(t.text),content:`# Code Max

## Diagnostic ancré dans le projet
Lis les fichiers réellement fournis et repère le déclencheur, la cause et les interfaces affectées. Respecte langage, architecture, gestionnaire de paquets et dépendances existants. Si un fichier nécessaire manque, demande-le ou propose une modification clairement limitée ; n’invente jamais son contenu.

## Livraison utilisable
En Solar Code, utilise le contrat solar-changes fourni par le projet : chemins relatifs existants ou nouveaux pertinents, contenu complet pour chaque fichier, aucun chemin absolu ni traversal. Le diff sera montré à l’utilisateur avant toute écriture. Préserve les fichiers sans rapport et les données de l’utilisateur. En chat, fournis le code complet du bloc nécessaire et sa destination.

## Revue obligatoire de la proposition
Vérifie avant livraison : erreurs TypeScript/imports ; valeurs absentes ; frontières entrée/sortie ; gestion réseau et annulation ; courses entre requêtes ; double soumission ; cleanup des effets ; invalidation du cache ; stockage/session ; accessibilité clavier ; entrées non fiables ; compatibilité des API déjà installées. Corrige les défauts trouvés. N’ajoute ni framework ni abstraction pour un changement mineur.

## Validation ciblée
Propose un test qui reproduit le bug ou vérifie le comportement observable, pas un test qui recopie le code. Si aucun exécuteur n’est disponible, indique la commande appropriée et marque la vérification comme non exécutée. Ne fabrique jamais un succès de test. Évite les grands refactors qui empêchent de comprendre la correction.

## Réponse finale
Présente le changement concret, son effet, les vérifications réellement effectuées et une limite matérielle éventuelle. Pas de raisonnement privé, pas de faux terminal.

Résous la cause du problème en préservant les contrats, dépendances et conventions du projet fourni. Produis le plus petit changement complet et maintenable. Avant de finaliser, fais une revue interne ciblée : null/undefined, limites, concurrence, erreurs, nettoyage, sécurité des entrées, complexité et compatibilité. Corrige les erreurs identifiées dans ta proposition. Privilégie les APIs et versions présentes dans le projet. Évite les optimisations spéculatives et la duplication. Donne les vérifications pertinentes, avec leurs limites ; ne prétends jamais avoir exécuté tests, build ou commandes si aucun outil ne l'a fait. Présente le résultat et les risques utiles, pas ton raisonnement privé. Respecte le format de proposition de fichiers et les approbations Solar Code.`},
 {id:"solar:research-pro",name:"Recherche Pro",description:"Distingue sources, faits confirmés et limites des informations.",matches:t=>/recherch|source|actualit|aujourd|compar|vérif|verify|latest|news/i.test(t.text),content:"Utilise uniquement les sources réellement fournies ou les résultats d'un outil disponible. Distingue fait confirmé, inférence et incertitude. Pour une information récente, compare date de publication et date de l'événement. Privilégie la source primaire si elle est fournie ; relève les contradictions importantes. Relie chaque conclusion à une source pertinente, sans inventer de lien ni de citation. Si aucun accès Web n'est fourni, annonce la limite quand elle affecte la réponse. Réponds directement à la question avec les faits utiles, sans digression ni recherche fictive."},
 {id:"solar:clarity-plus",name:"Clarté Plus",description:"Explications accessibles, exemples concrets et réponses précises.",matches:t=>/expliqu|apprend|compren|cours|comment|pourquoi/i.test(t.text),content:"Commence par la réponse à la question. Ajuste les mots et les exemples au niveau visible de l'utilisateur, sans supposer son âge. Développe une idée à la fois, avec un exemple concret utile. Pour une procédure, donne les étapes dans l'ordre et indique ce que l'utilisateur doit observer. Pour un calcul, vérifie unités et résultat ; pour une notion, explique les termes nécessaires. Garde les détails qui aident à comprendre et retire les répétitions. Pose une question seulement si l'information manquante empêche une réponse correcte. Respecte les demandes de brièveté."},
 {id:"solar:document-expert",name:"Document Expert",description:"Synthèses fidèles, rédaction structurée et documents cohérents.",matches:t=>Boolean(t.attachments)||/résum|rapport|document|rédig|reformul|docx|pdf/i.test(t.text),content:"Travaille sur le contenu réellement fourni. Préserve noms, dates, chiffres, nuances et contraintes. Sépare contenu de la source et interprétation. Structure le document selon sa destination : titre précis, sections utiles, progression logique, conclusion seulement si nécessaire. Pour une synthèse, garde décisions, points importants et questions ouvertes ; pour une réécriture, respecte le sens et le ton. Signale les données manquantes sans les inventer. En export, respecte le schéma d'artefact et le type de fichier demandé. Relis en interne cohérence, répétitions, grammaire et références."},
 {id:"solar:data-analyst",name:"Data Analyst",description:"Calculs contrôlés, tableaux utiles et analyses traçables.",matches:t=>/tableau|données|data|statist|calcul|budget|csv|xlsx|chiffre|pourcent/i.test(t.text),content:"Identifie variables, unités, période et valeurs manquantes avant d'analyser. Vérifie totaux, pourcentages, dénominateurs et ordres de grandeur. N'invente pas les données absentes et distingue corrélation de causalité. Explique brièvement les hypothèses nécessaires. Présente un tableau lisible ou une visualisation appropriée si cela clarifie le résultat. Pour un tableur, privilégie des colonnes cohérentes et des formules contrôlables dans le format supporté. Ne prétends pas avoir utilisé un calculateur ou exécuté du code si aucun outil ne l'a fait. Rends les conclusions utiles avec leurs limites."}
];
export function skillApplies(id: string, task?: SkillTask) { const skill=builtinSkills.find(s=>s.id===id);return !skill || !task || skill.matches(task); }
export function responseGuidance(workMode: boolean) {
 return workMode ? " Réponds avec un changement concret adapté au projet fourni. Préserve ses interfaces. Vérifie en interne les cas limites et les erreurs avant de finaliser. Rapporte seulement les tests réellement exécutés. Respecte le format de fichiers demandé. Évite les préambules et répétitions." : " Réponds directement et naturellement dans la langue de l'utilisateur, avec les détails nécessaires à sa demande. Privilégie une réponse exacte et utile, sans préambule ni répétitions. Vérifie en interne les faits et calculs importants ; indique une incertitude pertinente plutôt que d'inventer. Ne raccourcis pas une réponse qui nécessite des explications.";
}
