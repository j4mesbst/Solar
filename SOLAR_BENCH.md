# Solar Bench

Solar Bench exécute localement Ornith via Ollama et le runtime Cortex dans des projets temporaires isolés. Il n’utilise ni Codex, ni API OpenAI, ni service de jugement distant pendant une campagne.

## Installation utilisateur (macOS)

Depuis la racine du dépôt, installe le point d’entrée utilisateur réversible :

```bash
npm link "$(pwd)" --prefix ~/.local
```

Ajoute une seule fois `~/.local/bin` au `PATH` de zsh si nécessaire :

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zprofile
```

Puis, depuis n’importe quel Terminal :

```bash
solar-bench doctor
solar-bench run --preset smoke --variant cortex
```

`npm unlink solar --prefix ~/.local` retire le lien. Le runner n’installe jamais un modèle : installe explicitement le modèle voulu, par exemple `ollama pull ornith-1.5:9b`.

## Commandes

```bash
solar-bench run --preset smoke --variant both
solar-bench run --preset medium --model ornith-1.5:9b
solar-bench run --domain animations
solar-bench run --fixture swift-debug --variant native
solar-bench monitor
solar-bench resume --latest
solar-bench status
solar-bench history
solar-bench compare --latest
solar-bench report --latest --open
solar-bench report --latest --reveal
```

Les variantes `native` et `cortex` utilisent le même modèle, les mêmes fichiers initiaux, instructions et validateurs. La baseline native reçoit le même format d’actions et les mêmes droits de lecture/écriture limités ; elle n’a pas la boucle Cortex de planification, vérification et réparation.

## Moniteur séparé

Pour suivre une campagne sans dépendre de la sortie du Terminal qui l’a lancée, ouvre deux fenêtres :

```bash
# Terminal 1
solar-bench monitor

# Terminal 2
solar-bench run --preset smoke --variant both
```

Le moniteur lit uniquement `live-progress.json` dans le dossier de résultats local et se rafraîchit à chaque événement. Il affiche la fixture courante, Native/Cortex, le temps écoulé, la barre globale, les compteurs et le rapport final. `Ctrl-C` ferme le moniteur, pas le benchmark. Pour inspecter une campagne précise, utilise `solar-bench monitor --run <run-id>`.

## Résultats, reprise et limites

Les rapports sont conservés dans `~/Library/Application Support/Solar/benchmarks/<run-id>/` : `BENCHMARK_REPORT.md` et `BENCHMARK_RESULTS.json`. Chaque fixture est sauvegardée dès qu’elle se termine ; `resume --latest` ne relance pas celles déjà finalisées.

Le cache/identifiant de compatibilité inclut le commit Cortex, le modèle et son identité Ollama, la version du runner, le registre/validateur et les options. Une campagne interrompue peut être reprise. Un délai par fixture (10 minutes par défaut, configurable via `--timeout-ms`) ne modifie jamais les limites du runtime de production. Les flux restent surveillés par le watchdog Cortex ; un arrêt utilisateur est annulé proprement et donne un résultat partiel.

Le registre V2 comporte **25 exercices définis, cinq par domaine**. `smoke` en sélectionne 5, `medium` 10 et `full` 25. Les identifiants historiques sont conservés. Les validateurs renforcés sont versionnés V2 : les anciens résultats ne sont pas directement comparables aux nouveaux critères. La définition des exercices ne constitue pas un résultat Ornith.

Les validateurs sont indépendants : compilation Swift, assertions Node, build Vite, structure DOM et rendu WebKit/mesures temporelles lorsque le runtime WebKit est disponible. Une capture WebKit indisponible est rapportée comme non vérifiée/échec d’infrastructure, jamais comme une réussite visuelle.

## Cortex V3.3 — les deux fenêtres

Le dossier courant n’a plus d’importance. Ouvre deux fenêtres :

```bash
# Fenêtre 1 : suivi
solar-bench monitor

# Fenêtre 2 : 25 exercices Cortex, cinq par domaine
solar-bench run --preset full --variant cortex --model ornith-1.5:9b
```

`--variant both` évalue les 25 exercices dans les deux variantes, soit **50 exécutions** séquentielles. Les délais du benchmark restent configurables avec `--timeout-ms`. `Ctrl-C` dans sa fenêtre annule la tâche courante et sauvegarde l’état partiel. Les snapshots live conservent les compteurs et sont écrits atomiquement.

Les futures ablations utilisent `--disable` avec une liste séparée par des virgules : `cegis`, `visual-solver`, `evolution`, `semantic`, `atomic-actions`, `adaptive`. Chaque option entre dans la compatibilité du run. Une ancienne campagne dont le commit, le modèle ou les définitions ont changé est refusée à la reprise ; elle reste conservée sur disque.
