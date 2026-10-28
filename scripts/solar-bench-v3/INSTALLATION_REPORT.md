# Rapport d'installation

Date : 21 octobre 2026. Installation isolée sous `scripts/solar-bench-v3/.tools/`, ignorée par Git et absente des dépendances de production.

| Outil | Version figée | Méthode | Preuve |
|---|---:|---|---|
| Aider | 0.86.2 | `uv 0.13.4`, Python géré 3.12.15, `uv tool install aider-chat==0.86.2` | `aider --version` ; SHA binaire `52ff0504…` |
| OpenCode | 2.1.2 | npm local `@opencode/cli@2.1.2` | `opencode --version` ; SHA binaire `b6dc81ec…` |
| Ollama | client/serveur 0.40.1 | préexistant, aucune installation | modèle local détecté |

La première invocation `uv` a placé Aider sous `~/.local` par défaut. Cette copie a été désinstallée immédiatement, puis Aider a été réinstallé avec `UV_TOOL_DIR`, `UV_TOOL_BIN_DIR`, `UV_PYTHON_INSTALL_DIR` et `UV_CACHE_DIR` locaux à V3. Aucun PATH ou Python système n'a été modifié.

OpenCode V2 utilise le paquet officiel `@opencode/cli`, pas l'ancien `opencode-ai`. Son script post-installation vérifié a sélectionné le binaire Darwin ARM64. Les données/configurations des deux agents sont redirigées vers un dossier temporaire par essai ; analytics, mises à jour, partage et cloud sont désactivés.

Sources : documentation officielle [Aider](https://aider.chat/docs/install.html), [Aider + Ollama](https://aider.chat/docs/llms/ollama.html), [OpenCode V2](https://dev.opencode.ai/v2/docs), [OpenCode providers](https://dev.opencode.ai/v2/docs/providers/).
