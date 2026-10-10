# Comptes et plugins Solar

Les utilisateurs s'inscrivent auprès du même service Supabase configuré par le mainteneur, depuis n'importe quelle installation Solar. Il ne s'agit pas de profils réservés à un Mac. Les comptes ne sont pas activés tant que ce service n'est pas configuré ; le formulaire l'indique sans simuler une inscription.

## Activer les comptes pour la distribution

1. Créer un projet [Supabase](https://supabase.com/dashboard), puis activer l'authentification e-mail/mot de passe avec confirmation par e-mail.
2. Dans Connect / API Keys, récupérer l'URL du projet et sa **publishable key**. Ne jamais utiliser une clé secret ou service_role dans l'application.
3. Copier `.env.example` vers `.env`, renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`, puis redémarrer `npm run dev`. Les versions distribuées sont compilées avec ces deux valeurs publiques communes ; chaque utilisateur n'a pas à créer un projet.
4. Configurer Site URL et Redirect URLs pour le site Web Solar utilisé pour les liens de confirmation et de réinitialisation. Ce site doit servir cette interface pour afficher le formulaire de nouveau mot de passe. Sur macOS, l'utilisateur peut confirmer l'e-mail dans son navigateur, puis se connecter par mot de passe dans Solar.
5. Tester sur le vrai projet : confirmation d'adresse, connexion, déconnexion, e-mail de réinitialisation, nouveau mot de passe, expiration/renouvellement de session. Configurer le SMTP de production et ses quotas avant une distribution publique ; les tests automatisés actuels simulent le service Auth et ne prouvent pas la délivrabilité des e-mails.

[Documentation Supabase](https://supabase.com/docs/guides/auth/passwords).

Le bouton Compte Solar dans l'en-tête ouvre connexion, inscription, réinitialisation ou déconnexion. Les mots de passe sont envoyés au service Auth, jamais enregistrés par Solar. La session est persistée dans le Trousseau macOS pour les versions natives ; le navigateur utilise son stockage local. Les conversations, brouillons, providers, skills, artefacts et secrets de plugins ont un espace local distinct par identifiant de compte. Les données historiques sans compte restent dans l'espace invité et ne sont pas importées automatiquement. **L'historique n'est pas synchronisé entre appareils** : cette version ajoute l'identité en ligne, pas un stockage cloud des conversations. Les données locales ne sont pas chiffrées par ce mécanisme de séparation.

## GitHub

La connexion est utilisable avec un jeton personnel à accès limité : choisir les seuls dépôts nécessaires, permissions Metadata et Contents en lecture. Solar valide le compte via `/user`, liste les dépôts accessibles via `/user/repos` et lit le README du dépôt choisi. Le contenu devient une pièce jointe au brouillon ; l'utilisateur doit ensuite envoyer le message pour le transmettre au modèle. Aucun commit, PR ou message n'est créé par ce plugin.

Le jeton est enregistré dans le coffre existant, avec un identifiant séparé par compte : Trousseau macOS en natif, stockage du navigateur dans la version Web. Déconnecter retire le jeton de Solar ; pour révoquer un jeton GitHub au niveau du service, le supprimer dans les paramètres GitHub.

[Créer un jeton GitHub](https://github.com/settings/personal-access-tokens/new).

## Gmail

La recherche et la lecture sont disponibles avec l'API Gmail, avec la portée `gmail.readonly`. Les résultats affichent objet et expéditeur. Un e-mail choisi est ajouté au brouillon comme texte ; aucune instruction de l'e-mail n'est exécutée, aucune pièce jointe n'est téléchargée et aucun e-mail n'est envoyé, modifié ou supprimé.

Pour le bouton « Se connecter avec Google » dans la version Web :

1. Créer le projet Google Cloud de Solar, activer Gmail API et configurer l'écran de consentement.
2. Créer un client OAuth **Web**, autoriser les origines JavaScript exactes utilisées par Solar (par exemple `http://127.0.0.1:1420` en développement et le domaine Web de production).
3. Renseigner le client ID public dans `VITE_GOOGLE_CLIENT_ID`, puis reconstruire Solar.
4. En test, déclarer les utilisateurs test ; pour une distribution publique, suivre les exigences de validation Google relatives aux permissions Gmail avant de déclarer ce parcours disponible à tous.

Le token OAuth Gmail reste en mémoire pour la session et peut expirer : l'utilisateur doit alors reconnecter Gmail. Google Identity Services n'est pas lancé dans la WebView macOS ; **dans cette version native, les options avancées acceptent une autorisation OAuth Gmail en lecture seule déjà obtenue**. Une connexion native Google par navigateur avec retour automatique nécessitera un parcours OAuth desktop dédié ; elle n'est pas annoncée comme réalisée.

[Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/use-token-model) · [API Gmail](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list).

## Vérification

Les tests Playwright vérifient les interfaces avec des réponses API contrôlées : refus d'un jeton, validation d'identité, recherche, import sans envoi, signup avec confirmation, login/logout et isolation locale. Une vérification réelle de Google et Supabase exige les projets et autorisations du mainteneur. Aucune connexion réelle n'est héritée des plugins GitHub/Gmail de ChatGPT.
