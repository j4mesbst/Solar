# Progression publique

## 28 octobre 2026 — Solar 0.13.4

Fiabilisation des QCM, regroupement des réponses en trois bulles maximum, demandes d’aide au manager conservées dans le dialogue, nettoyage des commandes affichées et annulations. Fenêtre déplaçable depuis le haut ; thèmes clair/sombre et sélection grise des managers. Fournisseur, stockage, permissions et palettes personnalisées préservés.

Tests TypeScript, contrats Messenger et chat, parcours Playwright avec thèmes, pièces jointes, petites fenêtres et mouvement réduit validés. Les réponses des modèles peuvent varier. La position des boutons natifs reste dépendante de macOS ; badge de partage d’écran présent pendant la vérification locale.

Médias fournis et publication explicitement autorisée par James. Build public sans accès développeur personnel. Release macOS Apple Silicon signée ad hoc, sans notarisation. Aucun secret ou contenu de stockage local inclus dans le code publié.


## 0.14.0 — préparation multiplateforme

Adaptation Windows x64 : installateur NSIS, WebView2, stockage sécurisé, verrouillage de missions, navigateur OAuth, détection Ollama et capture audio locale via CPAL. macOS : marges des boutons à 20 points logiques. Validation Windows en cours sur runner natif ; téléchargement public courant conservé avant validation.

Vérifications de portage : bindings audio générés sur Windows ; copie des projets compatible avec les séparateurs Windows, chemins canoniques de sécurité conservés et current_dir npm normalisé. Aperçu WebKit limité au Mac ; contrôle WebView2 de l’application installée distinct. Installation propre npm 10.9.4 et métadonnées unzipper restaurées. Aucune permission supplémentaire accordée aux modèles.

Diagnostic Windows : les sous-processus Node reçoivent bien le PATH, mais Cargo y ajoute tous les répertoires de compilation Whisper (plus de 8191 caractères), ce qui fait ignorer la variable par cmd.exe. La CI compile les tests puis exécute directement le même binaire avec le PATH normal, comme l’application installée. Aucune vérification supprimée.

Tests natifs Windows et aller-retour d’un secret jetable dans Windows Credential Manager validés sur runner Windows. Build NSIS puis installation et lancement en cours. Le test de réparation npm sur copie est conservé et passe sans le PATH artificiellement allongé par Cargo.

### Validation finale 0.14.0

Runner Windows : 35 tests natifs réussis (deux tests explicitement ignorés), puis aller-retour réel dans Windows Credential Manager. Installateur NSIS de 8,37 MiB installé et lancé ; vraie WebView2 inspectée, contexte natif Windows, interface affichée, retrait latéral adapté et aucune erreur JavaScript non interceptée. Capture du premier lancement inspectée. SHA-256 Windows : 9dac453fa95158b93da38e3a4650cd2fe2620cb21a347da5073285b8874c396e.

DMG macOS 0.14.0 contrôlé, signature ad hoc et marges natives à 20 points. Interface clair/sombre, petit format, clavier, mouvement réduit et pièces jointes vérifiés avec les parcours Playwright existants sur Mac et profil Windows. Limites : microphone physique Windows et OAuth avec comptes personnels non testés sur le runner, pas de certificat éditeur Windows ni de notarisation Apple.
