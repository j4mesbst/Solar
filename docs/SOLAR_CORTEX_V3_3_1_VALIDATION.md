# Cortex V3.3.1 — fiabilité après Solar Bench

## Source et portée

Analyse de la campagne `2026-10-15T08-55-31-084Z-0293d710` : rapport, résultats JSON et 25 checkpoints. Résultat historique : 8 PASS, 11 STAGNATION, 3 FAIL, 3 TIMEOUT. Aucun `solar-bench run` exécuté pour cette correction. Aucun changement des fixtures ou de leurs critères de validation. Aucune nouvelle limite globale en production, aucun autre modèle, aucune modification de l’interface.

Les anciens checkpoints conservent les fichiers proposés, diagnostics et événements, mais pas les réponses d’actions de chaque génération. Ils ne permettent donc pas de reconstituer tous les patches intermédiaires. Le runtime conserve désormais les huit derniers tours d’actions (réponse bornée à 32 000 caractères avec indicateur de troncature), résultat et empreintes des fichiers, dans ses checkpoints locaux. Ces contenus de projet ne sont pas ajoutés au dépôt.

## Causes et corrections

| Cas observés | Cause documentée | Correction générique |
|---|---|---|
| refactor-multifile, refactor-cart, refactor-validation | 0 étape, événement « Réponse à la question », aucune modification : verbes Déplace/Extrais non reconnus | Reconnaissance des demandes d’extraction/déplacement et des variantes de refactorisation |
| feature | Syntaxe invalide persistante ; résultat final conservant une version vide malgré une proposition ultérieure | Une proposition vide ne peut plus devenir la meilleure candidate ; filtrage des modifications identiques à leur source |
| js-group-by | Appel `key(...)` alors que le contrat attend une clé de propriété ; même erreur répétée | Préservation des contre-exemples et refus des mutations identiques. La résolution sémantique reste à la charge du modèle |
| refactor-normalize | 218 étapes, assertion montrant une chaîne vide supplémentaire ; chemins temporaires différents à chaque test | Normalisation des chemins dans la signature de stagnation, conservation du diff complet attendu/obtenu, retour explicite « mutation sans effet » |
| visual-layout, visual-grid, visual-mobile-layout | Titres ou identifiants requis absents (`#card-a`, `#side`, etc.), observé null | Retour structurel prioritaire : restaurer React/HTML et les attributs exacts avant CSS. solveVisual ne classe plus une cible DOM absente comme infrastructure indisponible |
| visual-toolbar | Position y=85.4375 au lieu de 96 ; répétition sans correction mesurée | Diagnostics géométriques conservés, détection des patches sans effet ; aucune valeur de fixture injectée dans le moteur |
| ui-dialog | Collision entre bouton de fond et bouton du dialogue modal | Télémétrie limitée aux contrôles réellement actifs dans la couche modale, sans supprimer les vérifications indépendantes d’ouverture/fermeture |
| motion-simple | CSS sans balise `<style>` ouvrante dans le fichier conservé | Diagnostic structurel des balises style/script déséquilibrées ; aucune animation de substitution injectée par le runtime |
| motion-interactive | Fichier conservé : panel display:none, aucun gestionnaire/animation | Retour des erreurs de mouvement et de déclenchement ; aucun mouvement fabriqué pour faire passer le test |
| motion-reference | Animation présente mais absence de fallback réduit dans la version conservée | Feedback conservé ; préférence JS injectée dès le début du document, contrôle séparé des captures normales/réduites |
| motion-stagger | `matchMedia` évalué dans le script avant l’émulation tardive du renderer | Émulation à document-start, avant les scripts de la page ; règles CSS imbriquées réécrites sans perdre leurs contraintes de viewport |

CEGIS conserve désormais aussi le diagnostic du candidat rejeté après restauration du meilleur, au lieu de le remplacer par le seul nom du validateur. Une vérification réussie qui disparaît est considérée comme perdue. Les assertions sont transmises avec leur diff, et non seulement une ligne de pile. Les éléments temporels sont appariés par sélecteur stable et le mouvement est recherché dans les instants réellement capturés, pas seulement entre le premier et le dernier.

## Les trois timeouts

- `refactor-normalize` : 600.026 s, boucle de 218 étapes ; le délai du benchmark a fonctionné, mais les chemins de copies empêchaient la détection correcte de stagnation.
- `react-premium` : 894.851 s ; dernier événement à la génération 4, aucune proposition. Dépassement du délai d’annulation de 294.851 s.
- `ui-reference` : 1179.918 s ; dernier événement à la génération 4, aucune proposition. Dépassement du délai d’annulation de 579.918 s.

Pour les deux derniers cas, les traces établissent une attente de génération qui ne s’est pas libérée à l’annulation ; elles ne permettent pas d’attribuer le blocage exact à Ollama, au transport ou au nettoyage du reader. Le code attendait directement la promesse du fournisseur, puis attendait `reader.cancel()` dans le finally. Il n’imposait donc pas la libération de cette attente si l’adaptateur ignorait le signal. Désormais : attente sensible au signal, annulation explicite du reader, nettoyage non bloquant ; même protection pour la vérification externe. Le serveur d’assets WebKit ferme aussi ses connexions persistantes au nettoyage.

Trois notions restent distinctes :

1. Budget par fixture de Solar Bench (600 s configurées dans cette campagne), externe au runtime de production.
2. Watchdog d’inactivité d’un appel modèle (120 s par défaut) : réarmé par les octets réellement reçus, y compris les flux d’outils, pas seulement par le texte visible.
3. Délais techniques des opérations (compilation, renderer et transports), conservés. Aucune limite arbitraire de durée/étapes de tâche ajoutée en production.

Le plafonnement supplémentaire de l’adaptateur Bench à 2200 tokens empêchait le budget de premier artefact demandé par Cortex. Ce plafonnement a été supprimé ; les limites de sortie du backend restent effectives. Cette ligne est également présente dans le commit Solar Bench parallèle `925d2cf`.

## Vérifications

- `scripts/cortex-v3-3-1.test.mjs` : intentions de mutation, diff d’assertion, absence DOM, meilleure candidate non vide, stagnation sans effet, journal d’actions, annulation même avec adaptateur volontairement non coopératif.
- `scripts/cortex-v3-3-1-regression.test.mjs` : les huit cas demandés passent leurs validateurs indépendants, avec sources manuscrites déterministes et exécution Swift/Node/WebKit réelle. Aucun appel au modèle.
- WebKit réel : chronologie WAAPI 0→500 ms, préférence réduite évaluée au chargement, clic avec scale/opacité/flou, petit viewport, assets Vite et interaction React reconstruite dans une copie isolée.
- Contrats Cortex V3.3, Cortex général, agent et chat : réussis.
- Rust : 8 tests réussis, dont compilation/correction isolées, annulation, protections et rendu natif.
- Build TypeScript/Vite réussi ; avertissement existant sur la taille des chunks.

## Limites restantes

La campagne Ornith n’a pas été relancée, conformément à la consigne. Aucun nouveau taux de réussite, gain de vitesse ou gain de qualité du modèle n’est revendiqué. La capacité du modèle à exploiter ces diagnostics reste à mesurer avec la prochaine campagne utilisateur. La géométrie et les transitions observées ne constituent pas une note esthétique. Les horloges JavaScript arbitraires ne sont pas virtualisées : l’échantillonnage déterministe couvre CSS/WAAPI. Une annulation libère l’attente, mais ne peut garantir l’arrêt interne immédiat d’un service tiers qui ignore son propre signal ; les adaptateurs doivent toujours le respecter.
