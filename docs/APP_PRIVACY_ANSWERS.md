# App Store Connect — App Privacy ("nutrition label")

Réponses à cocher dans **App Store Connect → App Privacy**, en cohérence
avec `privacy-policy.html` et l'intégration AdMob + RevenueCat + Game
Center prévue à l'Étape 6. **Vérifie ces cases une fois les vrais SDK
branchés** : les réponses doivent refléter ce que le build final fait
réellement, pas seulement ce scaffold.

## "Est-ce que vous ou vos partenaires tiers collectez des données de cette app ?"
→ **Oui**

## Types de données à déclarer

| Catégorie Apple | Donnée précise | Utilisée pour | Liée à l'identité ? | Utilisée pour le suivi (tracking) ? |
|---|---|---|---|---|
| Identifiants | Identifiant publicitaire (IDFA) | Publicité tierce, Publicité/marketing du développeur | Non | **Oui** — uniquement si l'utilisateur autorise l'ATT |
| Achats | Historique d'achats | Fonctionnalité de l'app (restauration d'achats via RevenueCat) | Oui (associée à un ID utilisateur anonyme RevenueCat) | Non |
| Identifiants | ID utilisateur RevenueCat (anonyme, généré par device) | Fonctionnalité de l'app | Oui (pseudonyme, pas de PII) | Non |
| Identifiants | Game Center Player ID | Fonctionnalité de l'app (classements, succès) | Géré par Apple, hors périmètre de collecte propre à l'app | Non |
| Diagnostics | Données de plantage (si Xcode Organizer / crash reporting activé) | Diagnostics de l'app | Non | Non |

## Données explicitement **non** collectées
Nom, e-mail, numéro de téléphone, adresse physique, contacts, photos,
localisation précise ou approximative, contenu utilisateur, historique de
recherche/navigation, données de santé/financières.

## Suivi ("Tracking")
Réponds **Oui** à *"Cette app suit-elle les utilisateurs ?"* (à cause de
l'usage IDFA via AdMob pour la publicité personnalisée), avec pour seule
finalité déclarée : **Publicité tierce**. Le flux ATT (voir
`docs/BUILD_IOS.md` §6 et la checklist QA) doit être implémenté et
fonctionnel avant de soumettre avec cette réponse.

Si tu préfères éviter la déclaration "Tracking" entièrement, configure
AdMob en mode non-personnalisé uniquement (`requestTrackingAuthorization:
false`, ce qui est déjà la valeur par défaut dans `native-bridge.js`) et
ne demande jamais l'ATT — dans ce cas, réponds **Non** au tracking, et
retire la ligne IDFA du tableau ci-dessus. C'est le choix le plus simple
et le plus rapide à faire approuver ; le manque à gagner publicitaire est
en général faible pour un jeu casual.

## Résumé recommandé pour un lancement V1 simple
Si tu veux minimiser la complexité de la review pour la V1 : **désactive
l'ATT et les pubs personnalisées**, garde uniquement les lignes "Achats"
et "Game Center" du tableau, réponds **Non** au tracking. Tu pourras
activer les pubs personnalisées (et mettre à jour cette déclaration) dans
une mise à jour ultérieure.
