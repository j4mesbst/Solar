# Évaluation finale 4.1 — plan préparé, non exécuté

**Plan historique suspendu par la mission « Stabilisation avancée avant V5 » : aucun benchmark complet des 25 exercices avant Cortex V5. Ne pas exécuter la commande de campagne ci-dessous pendant cette phase. Voir `CORTEX_PRE_V5_PERFORMANCE_HYPOTHESES.md` pour les conditions actuelles.**

**Attendre l’autorisation explicite de James. Aucun benchmark modèle réel exécuté pendant cette mission.** Les commandes ci-dessous sont des instructions pour une campagne future, pas des commandes lancées par l’agent.

## 1. État reproductible

Depuis `/Users/James/Documents/Solar` : conserver branche/HEAD, diff local, empreintes des sources et fixtures/validateurs, Node/Rust/Swift/macOS/Ollama. La version du runtime doit indiquer4.1.0 ; le commit seul peut encore être44fe889 si les modifications restent locales. Archiver les contenus du diff/source en privé, pas seulement une clé de cache ; exclure secrets et contenu utilisateur.

Modèle identique au rapport de référence : `ornith-1.5:9b`, digest enregistré `e5df7dcdd8a263994df62d610317e07be0d6af23f96fcbd8543273058fce575e`, Q4_K_M, contexte déclaré262144 (ne pas l’utiliser automatiquement). Le runner doit enregistrer l’identité réellement constatée. Si les poids/quantification diffèrent, ne pas présenter la comparaison comme appariée. Pas de téléchargement/mise à jour automatique.

Même machine, fenêtre4K/8K selon configuration documentée, même politique keep-alive et charge système comparable. Rapporter état chaud/froid, queue serveur et pression mémoire si mesurables, sinon « non mesuré ». Aucun autre benchmark en parallèle.

## 2. Une campagne comparative après autorisation

Le preset full contient25 fixtures, cinq par domaine. La variante both produit50 exécutions (25 Native +25 Cortex), pas25 au total. Cela représente un coût supérieur au précédent run Cortex seul et doit être autorisé comme tel.

```bash
cd /Users/James/Documents/Solar
npm run solar-bench -- run --preset full --variant both --model ornith-1.5:9b --timeout-ms 600000 --no-cache
```

Ne pas répéter automatiquement. Le timer600s est une condition du benchmark, pas un plafond du runtime de production. Si l’autorisation porte seulement sur25 exécutions, utiliser la variante cortex et annoncer explicitement l’absence de baseline Native appariée ; ne pas prétendre mesurer un gain causal contre le modèle brut.

Les fixtures et validateurs restent identiques. Ne pas remplacer un FAIL par PASS sur la base d’un score interne ou d’un auto-test modèle. Examiner les preuves qui divergent : source, scénario/viewport, outil/version, assertion indépendante, état de tâche et raison d’arrêt.

## 3. Scénarios inédits, séparément autorisés

Ne pas les ajouter aux25 fixtures pour modifier leur dénominateur. Préparer quelques tâches privées et isolées, avec verdict indépendant écrit avant génération :

- Extraction multi-fichiers CommonJS avec autre API, imports explicites et changement concurrent conservé.
- Dialogue et formulaire avec texte, value, attribut booléen et effet réellement attendu ; contrat modèle volontairement incohérent comme test négatif déterministe, distinct de la génération réelle.
- Carte interactive à ouvrir puis fermer, scale/opacity/blur, observations séparées et reduced-motion.
- Deuxième tour conservant les contraintes de dépendances/style/clavier du premier ; aucune réponse assistant non vérifiée promue comme vérité.
- Pause de compilation puis reprise, et modification des poids/endpoint refusée ; dépendance changée invalidant preuve/mémoire.

Exiger résultats vérifiables, pas jugement du générateur. Pour esthétique, comparaison aveugle par personne indépendante ; captures conservées avec source, viewport, scénario et instants. Pas d’images ou scores inventés. Les fonctionnalités clavier/horloge virtuelle non disponibles ne deviennent pas déclarées supportées par un test de clic.

## 4. Mesures et lecture

Conserver réussite, échec/stagnation/timeout/interruption, durée réelle, appels par rôle, tokens réellement mesurés/absents, compilations/captures exécutées ou réutilisées, réparations, régressions, checkpoints et interventions. RSS runner et size_vram ne sont pas RAM totale : les afficher comme telles. Les flux interrompus gardent leurs métriques partielles sans être convertis en zéro consommation.

Comparer les distributions par domaine et les mécanismes de panne, pas seulement un total. Un gain sur une campagne ne prouve ni ×10, ni généralisation multi-modèle, ni autonomie sans surveillance. Aucun changement de limites/validateurs après examen des résultats pour embellir le score.

## 5. Conditions de lancement

Tests déterministes, typage/build et contrôles natifs ciblés documentés dans [VALIDATION](CORTEX_V4_1_VALIDATION.md). Sandbox OS absente : uniquement projets synthétiques approuvés, jamais code distant non fiable ou répertoire contenant des secrets. Propositions sans écriture automatique. Au premier incident technique, conserver checkpoint et diagnostic ; ne pas lancer une nouvelle campagne à l’insu de l’utilisateur.
