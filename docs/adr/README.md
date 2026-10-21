# Architecture Decision Records — chatbot-frontend

Back-office Next.js du projet Brain. ADR rédigés le 2026-10-17 à partir de l'historique du projet ; les dates indiquent quand la décision a été prise. Les décisions côté serveur sont dans `chatbot-backend/docs/adr/`.

Un ADR documente **une** décision d'architecture : son contexte, ce qui a été décidé et ses conséquences. Un ADR accepté n'est pas réécrit : si la décision change, on crée un nouvel ADR qui le **remplace** et on met à jour le statut de l'ancien.

Pour en ajouter un : copier [`template.md`](template.md), prendre le numéro suivant, l'ajouter au tableau ci-dessous.

| N° | Décision | Statut | Date |
|---|---|---|---|
| [0001](0001-next-js-app-router-et-react-19-rendu-serveur-pour-le.md) | Next.js (App Router) et React 19, rendu serveur pour le premier affichage | Accepté | 2026-09-15 |
| [0002](0002-proxy-bff-next-js-vers-le-backend-et-jeton-de-session-en.md) | Proxy BFF Next.js vers le backend et jeton de session en cookie httpOnly | Accepté | 2026-09-26 |
| [0003](0003-identifiants-de-connexion-chiffres-cote-navigateur-rsa-oaep.md) | Identifiants de connexion chiffrés côté navigateur (RSA-OAEP) | Accepté | 2026-09-27 |
| [0004](0004-etat-global-minimal-avec-redux-toolkit-donnees-de-page-dans.md) | État global minimal avec Redux Toolkit, données de page dans des hooks | Accepté | 2026-09-15 |
| [0005](0005-permissions-casl-cote-interface-alignees-sur-les-sujets-du.md) | Permissions CASL côté interface, alignées sur les sujets du backend | Accepté | 2026-09-17 |
| [0006](0006-client-api-unique-axios-et-telechargements-par-blob.md) | Client API unique (axios) et téléchargements par blob | Accepté | 2026-09-26 |
| [0007](0007-formulaires-controles-et-validation-yup.md) | Formulaires contrôlés et validation yup | Accepté | 2026-09-15 |
| [0008](0008-interface-maison-avec-tailwind-css-et-lucide-react.md) | Interface maison avec Tailwind CSS et lucide-react | Accepté | 2026-09-15 |
| [0009](0009-assistant-ia-socket-io-cote-client-domaines-de-conversation.md) | Assistant IA : socket.io côté client, domaines de conversation explicites | Accepté | 2026-09-23 |
| [0010](0010-dates-envoyees-en-jours-calendaires.md) | Dates envoyées en jours calendaires | Accepté | 2026-09-27 |
| [0011](0011-traitements-longs-suivis-par-interrogation-periodique-d-une.md) | Traitements longs suivis par interrogation périodique d'une tâche | Accepté | 2026-10-15 |
| [0012](0012-revue-des-changements-avant-application.md) | Revue des changements avant application | Accepté | 2026-10-16 |
