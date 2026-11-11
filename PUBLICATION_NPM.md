Journal technique — Publication npm TelepathyMQ

Dernière mise à jour : 6 novembre 2026

1. Objectif

Publier publiquement le package :

Nom : @na1647/telepathymq
Version : 2.0.0
Compte npm : na1647
Registry : https://registry.npmjs.org/
Répertoire : /git/telepathymq
2. Environnement de développement

Machine : Fedora 42 Workstation Edition
Session graphique : Wayland

Gestionnaire de versions : NVM

Composant	Version	Utilisation
Node.js	20.20.0	Applications habituelles
Node.js	22.23.4	Publication npm
npm sous Node 20	11.21.2	Environnement habituel
npm sous Node 22	12.2.2	Staged Publishing

Important : conserver Node.js 20.20.0 comme version par défaut. Les applications utilisant Socket.io 2 doivent rester compatibles avec cet environnement.

Commandes :

nvm use 20 : environnement habituel.
nvm use 22 : environnement de publication.
3. Problème d'authentification

La connexion npm login fonctionne.

La publication classique avec :

npm publish --access public

déclenche une authentification par clé de sécurité.

La clé est enregistrée sur le téléphone et fonctionne sous Firefox Windows grâce au QR code.

Sous Fedora, Firefox et Chrome affichent « Use security key », mais ne proposent pas correctement l'authentification par téléphone.

4. Solution retenue : Staged Publishing

La fonctionnalité npm Staged Publishing a été identifiée.

Commandes disponibles :

npm stage publish
npm stage list
npm stage view <stage-id>
npm stage approve <stage-id>
npm stage reject <stage-id>
npm stage download <stage-id>

Principe :

npm stage publish prépare une publication sans demander la 2FA.
npm stage approve effectue réellement la publication et exige la 2FA.
5. État actuel du compte npm
Le 6 novembre 2026, la commande :

npm stage publish

a échoué avec :

E403 - Your account has been temporarily suspended due to a recent security-sensitive action.

Le compte npm est donc temporairement suspendu pour les opérations sensibles.

J'ai utilisé un code de récupération npm le 5 novembre 2026.

Une suspension de sécurité de 72 heures est une cause possible. Il faut vérifier auprès de npm que le compte est effectivement débloqué avant toute nouvelle tentative.

Date indicative de reprise : 8 novembre 2026, à l'heure correspondant à l'utilisation du code de récupération.

6. Historique des commandes importantes
Vérification du compte :

npm whoami

Résultat : na1647

Registry :

npm config get registry

Résultat : https://registry.npmjs.org/

Package :

name : @na1647/telepathymq
version : 2.0.0
La préparation du package a bien fonctionné : 6 fichiers, archive de 8,2 kB.

Aucune publication réussie n'a été confirmée.

7. Prochaines étapes
À la reprise :

Vérifier que la suspension npm est levée.
Passer sur Node 22 : nvm use 22
Vérifier : node -v npm -v
Se placer dans : /git/telepathymq
Exécuter : npm stage publish --access public
Vérifier : npm stage list
Examiner le package avec : npm stage view <stage-id>
Procéder à l'approbation avec : npm stage approve <stage-id>
L'authentification finale devra être effectuée avec la clé de sécurité depuis Windows si nécessaire.

8. Précautions
Ne pas réinstaller Node ou npm.
Ne pas supprimer Node 20.20.0.
Ne pas modifier inutilement package.json.
Ne pas modifier les paramètres 2FA.
Ne pas utiliser de nouveau code de récupération.
Ne pas multiplier les tentatives pendant la suspension.
Ne pas relancer npm publish classique sans raison.
Vérifier le résultat de chaque étape avant de poursuivre.
9. Résultat attendu
Publication réussie de :

@na1647/telepathymq@2.0.0

sur le registre public npm, sans modifier l'environnement de développement Node.js 20.20.0.