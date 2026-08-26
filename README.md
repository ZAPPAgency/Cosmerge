# Godspark

Jeu merge/idle/prestige spatial, prévu pour iOS via Capacitor. Ce dépôt
contient le **projet complet** (code source, config Capacitor, assets,
documentation de soumission App Store).

## Structure

- `www/` — le jeu lui-même (HTML/CSS/JS vanilla, sans framework ni étape de
  build). C'est aussi la seule partie déployée en direct sur le web pour
  les tests, dans un **second dépôt séparé** :
  **[ZAPPAgency/Cosmerge](https://github.com/ZAPPAgency/Cosmerge)**
  (GitHub Pages, en ligne à https://zappagency.github.io/Cosmerge/).
  `www/` y est synchronisé par copie (`rsync`), ce dépôt-ci n'est pas
  connecté à ce déploiement.
- `docs/` — toute la documentation de soumission App Store : build iOS,
  checklist QA, métadonnées, réponses aux questionnaires Apple
  (confidentialité, classification d'âge). **Commencer par
  `docs/BUILD_IOS.md`** pour le build natif.
- `capacitor.config.ts` / `package.json` — config du projet Capacitor.
  L'`appId` dans `capacitor.config.ts` est encore un placeholder
  (`com.example.godspark`) à remplacer par le vrai identifiant une fois
  l'App ID créé dans App Store Connect.
- `assets/` — icône source (1024×1024), jeu d'icônes iOS déjà généré (à
  refaire, voir `docs/QA_CHECKLIST.md`), captures d'écran (à refaire
  aussi, elles datent d'avant plusieurs refontes de l'UI).
- `game-full.html` / `cosmerge-v2.html` — versions à fichier unique
  (CSS/JS inlinés), utilisées pour tester le jeu ailleurs que via un
  serveur local. Régénérées par le script Python en fin de
  `docs/BUILD_IOS.md`-adjacent workflow (voir historique des commits).

## Pour builder pour iOS

Tout est détaillé dans [`docs/BUILD_IOS.md`](docs/BUILD_IOS.md) : comptes
requis (Apple Developer, AdMob, RevenueCat), installation, build Vite,
Xcode, StoreKit Sandbox, TestFlight.

## Pour continuer à modifier le jeu web (sans toucher à iOS)

Éditer directement dans `www/`, puis synchroniser vers le dépôt de
déploiement :

```bash
rsync -a --delete --exclude='.git' www/ ../cosmerge-web/
cd ../cosmerge-web && git add -A && git commit -m "..." && git push
```

(`../cosmerge-web` est un clone local de
[ZAPPAgency/Cosmerge](https://github.com/ZAPPAgency/Cosmerge) - à cloner
si tu ne l'as pas déjà.)
