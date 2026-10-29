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

## 29 octobre 2026 — préparation 0.15.0

Connexions OAuth démarrées au clic, statut dans l’app et annulation ; page HTML de fin inspirée de la référence, vérification d’identité réelle avant succès, lien de retour vers Solar. Menu de compte vertical, prénom et raccourci Plugins, icônes MIT animées, retrait du dégradé supérieur. Animation de lancement sur blanc, logo existant, shader et ressort issus du moteur fourni ; interruption en mouvement réduit et repli en cas de WebGL indisponible.

Mise à jour native : détection du dernier tag stable GitHub, comparaison stricte des versions, disponibilité des deux fichiers installateur/empreinte ; contrôle SHA-256 avant exécution, verrou d’installation, installation NSIS et /R Windows ; remplacement local Mac avec copie préalable, signature vérifiée et restauration si remplacement impossible. Aucune clé privée distribuée. Les anciens builds 0.14 ne contiennent pas ce bouton ; première installation 0.15 nécessaire pour les suivantes.

TypeScript et build frontend validés, contrats Messenger/chat et parcours UI (thèmes, fichiers, clavier, petit format, mouvement réduit, modèles) validés. Tests natifs en cours de vérification. OAuth réel avec comptes personnels et mise à jour complète entre deux releases restent à confirmer ; ne pas annoncer ces parcours comme validés par des fixtures seules.

### Validation et livraison 0.15.0

37 tests natifs réussis sur Mac (exécution séquentielle) et Windows, deux tests matériel explicites ignorés ; aller-retour Credential Manager réussi. Contrats Messenger/chat réussis. Parcours Playwright : thèmes, petite fenêtre, clavier/focus, fichiers, QCM et modèles conservés ; menu en lignes inspecté. Test WebGL réel : rendu du verre, fin et nettoyage sans erreur ; fixture du transport MAJ : affichage conditionnel et refus pendant une tâche. Correction du canvas perdu lors du remontage StrictMode.

Windows : run 40858453987, compilation NSIS, installation et lancement natifs, WebView2 sans erreur JavaScript. Mac : DMG public reconstruit et signature ad hoc contrôlée ; SHA-256 d0250713f33fdd4fce9fcc8c8de02b29763af43c3cd9495938319ca33285581c. Copie personnelle mise à jour dans /Users/James/Applications/Solar.app avec sa configuration locale préservée, ouverture observée avec agents/historiques existants et nouveaux boutons. Aucun écran privé ajouté au dépôt.

Limites : OAuth complet avec comptes personnels et remplacement automatique entre deux versions différentes non exécutés comme tests de bout en bout. La page de retour est testée avec callback local et le succès dépend du contrôle d’identité et de sauvegarde ; aucun succès OAuth simulé. Les builds publics conservent les exigences de configuration des connecteurs ; aucune clé ou configuration confidentielle personnelle ajoutée. Mise à jour Mac requiert une app installée hors DMG et un dossier accessible en écriture. Les versions 0.14 et antérieures nécessitent cette première installation manuelle.

## 29 octobre — préparation 0.15.1

Footer conforme à la nouvelle référence, vraies connexions seulement, marges de 20 px. Champ et + réduits de 20 %, thème de lancement noir avec éclairage. Nuage pour MAJ dans cette version ; l’ancienne 0.15 garde son icône de téléchargement jusqu’à la mise à jour. Aucune intervention sur l’app installée, aucun clic MAJ : test réservé à James.

Validation locale : build TypeScript/Vite et bundle Mac réussis, signature ad hoc vérifiée. Playwright mesure 36,8 px pour le champ et le bouton +, ≥20 px aux bords, trois logos issus de connexions de test enregistrées, menus et saisie clavier ; clair/sombre, petit format et mouvement réduit vérifiés. WebGL noir et nettoyage du canvas sans erreur. Contrats Messenger et chat réussis. Transfert du lockfile GitHub corrigé et vérifié octet pour octet ; validation Windows relancée. Aucun changement de l’app installée de James.

Windows validé : run 40861522353 réussi, tests natifs et Credential Manager, installation NSIS et démarrage réel WebView2 sans erreur JavaScript. DMG Mac 0.15.1 vérifié (SHA-256 13c0787295b2d669623054159139f497c13c3ff34f93cc5c4500c4f7722d6ff6). Aucune installation dans /Users/James/Applications : Info.plist toujours 0.15.0. Publication uniquement pour laisser James tester la mise à jour depuis cette version ; son ancien bouton garde son icône jusqu’à installation. Le test utilisateur réel de remplacement/réouverture reste volontairement non exécuté par l’agent.

## 29 octobre — finitions demandées après le test réussi de mise à jour

Nouvelle préparation dans /tmp/solar-0152 depuis main, sans remplacer l’app installée : compte compact sans chevrons, indicateur de clic sur identité au survol/focus, icône sidebar arrondie et suppression du délai de fond à l’ouverture ; verre accéléré ×1,5, yeux blancs et sortie en deux volets diagonaux au lieu d’une coupure. Build TypeScript/Vite validé. Playwright valide le menu de 200 px sans chevrons, apparition/disparition de la flèche au survol, fond de sidebar immédiatement présent à la réouverture, clair/sombre, petite fenêtre, clavier, pièces jointes et mouvement réduit. Rendu WebGL, volets diagonaux et nettoyage sans erreur JavaScript inspectés sur captures. Mise à jour 0.15→0.15.1 confirmée par James ; aucune nouvelle connexion ni authentification personnelle exécutée.

Limites de cette préparation : aucune publication 0.15.2, aucun remplacement de l’app installée ni clic de mise à jour. Authentification Solar avec compte personnel et rendu natif Windows non retestés pour ces seuls ajustements visuels ; les parcours de fournisseur et de stockage ne sont pas modifiés.

## Publication 0.15.2 demandée par James

Version et liens de téléchargement actualisés ; build frontend, contrats Messenger/chat et contrôles visuels validés. Publication conditionnée à la compilation, aux tests natifs et au démarrage des installateurs macOS/Windows, avec empreintes SHA-256. App personnelle laissée en place pour le test du nuage par James.

### Livraison publique 0.15.2

Release stable publiée : https://github.com/j4mesbst/Solar/releases/tag/v0.15.2. Source 45f43cd8d2bef88ef17586a2b5221f7d6e09e5df ; arborescence distante identique à la préparation locale. Runs macOS 40866796705 et Windows 40866796664 réussis ; finalisation 40868360591 réussie. DMG vérifié, signature ad hoc et fenêtre native observée ; NSIS installé et fenêtre Windows démarrée. Téléchargements publics retéléchargés et empreintes contrôlées : macOS a850bc8923680e20c60fdc4cdb696042516967e3f43a0aae3d0235a96a385de5 ; Windows 40bb00a99cc5390ee2da31bb7e004a41ac756ed35d363cc61ca65780b8057b4b. Point releases/latest vérifié : 0.15.2 avec installateurs et sommes attendus par le nuage de 0.15.1. Aucun remplacement ni relancement de l’app personnelle. OAuth personnel et microphone physique non retestés pour cette publication.

## 29 octobre — correctif Trousseau 0.15.3

Cause observée dans le code : stockage séparé par secret, cache par clé seulement ; les autorisations du Trousseau peuvent être redemandées pour chaque entrée après les signatures ad hoc des mises à jour. Nouveau coffre macOS AES-256-GCM, clé aléatoire de 256 bits dans une entrée du Trousseau, lue une fois par session. Nonces aléatoires, AAD du service, mutex et flock, fichiers 0600 et dossier 0700, sauvegarde atomique. Anciennes entrées migrées à la lecture et conservées pour récupération ; les suppressions applicatives créent un tombstone afin de ne pas les réimporter. Windows conserve son stockage natif. Aucune clé personnelle consultée pendant le développement.

Limite réelle : la première migration peut encore entraîner les demandes macOS propres aux anciennes entrées ; aucun contournement des ACL ni désactivation du Trousseau. Ensuite l’unique clé peut demander une autorisation après un changement de signature ou selon les réglages macOS. Un refus est mémorisé jusqu’à la fermeture pour éviter les demandes répétées ; une relance permet de réessayer. Décompte des dialogues avec les comptes personnels non vérifié automatiquement.

Validation locale : 44 tests natifs réussis, deux tests matériels explicites ignorés. Sept tests du nouveau coffre : déverrouillage unique pour huit secrets concurrents, persistance, permissions, comptes et tombstones, refus sans répétition, isolation des accès concurrents, intégrité/clés incorrectes et nonces distincts. Build TypeScript/Vite et contrats Messenger/chat réussis. Publication 0.15.3 en préparation ; aucun accès aux identifiants personnels ni installation de la nouvelle version sur l’app de James.

### Livraison publique 0.15.3

Release stable https://github.com/j4mesbst/Solar/releases/tag/v0.15.3, source 5bb993f1e9fa70c02f57314807ddd29a7d725eb4. Runs de packaging macOS 40883260070 et Windows 40883259927 réussis ; finalisation 40886090559 réussie. DMG et fenêtre native vérifiés ; NSIS installé et fenêtre Windows démarrée. Téléchargements publics retéléchargés : macOS SHA-256 27f2c678cec0af835bdb506948575b2ec33acae5c48b0ed372385b53366e2a46 ; Windows 83665b9182df76d9af3ffd68afdc5205f01850e02856840b52c0930b639af460. releases/latest pointe bien sur 0.15.3 et inclut les assets et sommes nécessaires au nuage. Le workflow de validation redondant indique un échec global avec son job native-macos annulé (sans étape en échec ni logs disponibles), tandis que son frontend réussit et que les deux workflows de packaging exécutent et réussissent leurs tests natifs. Aucun remplacement de l’app personnelle ; décompte réel des dialogues lors de la migration à confirmer par James.
