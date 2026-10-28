<div align="center">

<img src="assets/readme/logo.png" alt="Solar" width="112" />

# Solar 0.13.4

**Votre équipe d’agents IA, dans une application macOS.**

Des conversations courtes, des agents personnalisables et le modèle de votre choix.

[![Télécharger pour macOS Apple Silicon](https://img.shields.io/badge/Télécharger_macOS-Apple_Silicon-007AFF?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/j4mesbst/Solar/releases/download/v0.13.4/Solar-0.13.4-macOS-arm64.dmg)

[Notes de version](https://github.com/j4mesbst/Solar/releases/tag/v0.13.4) · [Signaler un problème](https://github.com/j4mesbst/Solar/issues) · [Licence MIT](LICENSE)

</div>

## Découvrir Solar

[![Voir la démonstration vidéo](assets/readme/screenshots/solar-jerry.png)](https://github.com/j4mesbst/Solar/releases/download/v0.13.4/Solar-demo.mp4)

**[Voir la démonstration vidéo](https://github.com/j4mesbst/Solar/releases/download/v0.13.4/Solar-demo.mp4)**

## Solar aujourd’hui

Solar est une application open source construite avec Tauri, React et TypeScript. Créez vos agents, donnez-leur une mission et échangez avec eux dans une messagerie native. Chaque agent garde son identité, sa conversation et ses autorisations.

![La conversation de Jerry](assets/readme/screenshots/solar-jerry.png)

![Créer et personnaliser Jerry](assets/readme/screenshots/solar-create-jerry.png)

- **Une équipe à votre image.** Cinq formes animées, couleur personnalisable et messages assortis. Déplacez un agent en haut de la barre latérale pour en faire un manager, ou réordonnez-le par glisser-déposer. Le clic droit permet de le supprimer de l’équipe ; Annuler le restaure. Son historique est conservé et ses routines restent désactivées après restauration.
- **Une conversation à la fois.** Réponses en bulles successives, choix multiples quand ils sont utiles, brouillons et pièces jointes. Le statut d’un connecteur apparaît uniquement pendant une opération réelle. Après une absence prolongée, Solar peut proposer de reprendre une demande existante, sans lancer de requête avant votre choix.
- **Des autorisations explicites.** Lecture seule, accès standard ou accès complet, choisis pour chaque agent. Le rôle d’un agent ne lui accorde pas de permissions supplémentaires. Les accès dépendent aussi du compte connecté et de ses autorisations.
- **Une bibliothèque simple.** Ajoutez un dossier pour retrouver son nom et sa liste de fichiers dans la bibliothèque de l’agent. L’ajout n’envoie pas automatiquement son contenu à un modèle et ne lui accorde pas de droit d’écriture.
- **Votre apparence.** Modes clair, sombre et personnalisé, typographie native et respect du mouvement réduit.

## Trois façons de choisir un modèle

![Choix du modèle](assets/readme/screenshots/solar-0132-models.png)

| Choix | Fonctionnement |
| --- | --- |
| **Modèle local** | Lancez [Ollama](https://ollama.com), installez un modèle, puis cliquez sur **Détecter**. Solar sélectionne un modèle installé. Aucun abonnement cloud n’est nécessaire pour l’inférence locale. |
| **Clé OpenAI** | Entrez votre clé personnelle dans Solar. Elle reste dans le Trousseau macOS ; les requêtes sont facturées par OpenAI selon votre compte. Solar vérifie le catalogue accessible avant de sélectionner un modèle compatible. |
| **Solar Cloud** | Option gratuite lorsque le service est configuré sur votre compte. Cette version open source ne distribue aucune clé privée ni accès cloud universel ; la disponibilité dépend du fournisseur et de ses limites. |

Solar utilise le modèle sélectionné, sans basculer silencieusement vers un autre fournisseur. Un modèle local peut avoir moins de capacités d’outils ou de vision qu’un modèle cloud.

## Applications connectées

![Connecter vos applications](assets/readme/screenshots/solar-connections.png)

![Catalogue des plugins](assets/readme/screenshots/solar-plugins.png)

La galerie permet de connecter les services dont les adaptateurs sont implémentés, notamment Gmail, Google Agenda et GitHub selon la configuration de l’application et de votre compte. Les icônes et états de connexion reflètent les services réels. Certaines entrées nécessitent votre propre configuration OAuth, une clé ou un serveur MCP ; leur présence dans la galerie ne signifie pas qu’elles sont déjà utilisables.

Les clés personnelles sont conservées dans le Trousseau. Les lectures concurrentes du même secret sont regroupées et mises en cache en mémoire pendant la session. macOS peut demander une autorisation initiale ; Solar ne désactive pas les protections du système.

## Télécharger et installer

**[Télécharger Solar 0.13.4 pour macOS — Apple Silicon (.dmg)](https://github.com/j4mesbst/Solar/releases/download/v0.13.4/Solar-0.13.4-macOS-arm64.dmg)**

1. Ouvrez le DMG et déplacez **Solar.app** dans **Applications**.
2. Lancez Solar et choisissez un modèle dans **Modèles**.
3. Créez votre premier agent. Les connexions de services sont facultatives.

Le téléchargement fourni est destiné aux Mac **Apple Silicon (arm64)** sous **macOS 11 ou version ultérieure**. Il est signé localement (ad hoc), sans notarisation Apple : macOS peut afficher un avertissement de provenance. Une version Intel précompilée n’est pas fournie. Les sommes SHA-256 sont jointes à la release.

## Nouveautés de la 0.13.4

- QCM demandés ou spontanés plus robustes, avec trois propositions adaptées au rôle.
- Deux bulles de réponse privilégiées, trois au maximum ; code, tableaux et cartes conservés.
- Demandes d’aide au manager traitées comme une conversation avant toute délégation.
- Statuts d’outils lisibles, sans balises de commande ; annulations reformulées en français.
- Zone supérieure pour déplacer la fenêtre et boutons macOS repositionnés.
- Thèmes clair et sombre affinés, sélection du manager grise et palettes personnalisées conservées.

Les captures et la vidéo ci-dessus ont été fournies par James et montrent la session précédant les dernières finitions de la 0.13.4.

## Limites actuelles

- **Ordinateur : bientôt.** L’onglet annonce le navigateur Solar ; il ne promet ni machine virtuelle ni contrôle autonome du Mac.
- L’exécution d’agents dépend du modèle, des intégrations configurées et de leurs limites. Les résultats importants doivent être vérifiés.
- Une routine nécessite une application en cours d’exécution ; Quitter et la veille interrompent le travail. Le code du moteur et des routines reste présent, même si leurs anciens formulaires ne sont plus affichés dans le panneau Détails.
- Les conversations, brouillons et paramètres sont stockés localement. Un compte en ligne ne constitue pas une sauvegarde ou synchronisation complète.
- « Local » concerne l’inférence : un connecteur, une recherche web ou un modèle cloud utilise le réseau. Les services OAuth et Solar Cloud nécessitent une configuration côté opérateur ; aucun secret de déploiement n’est fourni dans le dépôt.

## Développer

Prérequis : Node.js 24, Rust stable, Xcode Command Line Tools sur macOS et les [prérequis Tauri](https://v2.tauri.app/start/prerequisites/).

```sh
git clone https://github.com/j4mesbst/Solar.git
cd Solar
npm ci
npm run tauri -- dev
```

L’interface seule peut s’ouvrir avec `npm run dev`. Les commandes natives, le Trousseau et les sélecteurs de fichiers doivent être vérifiés dans l’application macOS.

Copiez `.env.example` vers `.env.local` seulement si vous configurez un service optionnel. Les identifiants publics OAuth et Supabase sont distincts des secrets serveur. N’ajoutez jamais de clé privée à une variable `VITE_` ou à Git.

```sh
npm run build
node scripts/messenger-contract.test.mjs
npm run test:chat
npm run test:agent:durable
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

Pour compiler un bundle macOS :

```sh
npm run tauri -- build --bundles app,dmg
```

## Contribuer

Les problèmes reproductibles, captures sans données privées et pull requests sont les bienvenus. Précisez macOS, architecture, version de Solar et modèle utilisé. N’incluez pas de conversation privée, jeton, clé API ou fichier personnel dans un rapport.

Solar est distribué sous [licence MIT](LICENSE). Les marques des services connectés appartiennent à leurs propriétaires.
