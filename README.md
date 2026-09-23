# Chatbot Back-office — Front-end Next.js

Front-end (Next.js 16 / App Router / TypeScript / Tailwind v4 / **Redux
Toolkit** / axios) branché sur l'API **chatbot-backend** (NestJS) dont le
schéma a été extrait directement depuis son document Swagger :
`GET {API}/swagger-json` (endpoint réel : `/chatbot-backend/api/v1/swagger-json`).

Ce projet est un **nouveau front indépendant** qui consomme le backend
existant — il ne reprend pas le code de `chatbot-backoffice`, seulement les
contrats d'API qu'il expose.

## Démarrage rapide

```bash
npm install
cp .env.local.example .env.local   # ajustez l'URL de l'API si besoin
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000). Connectez-vous avec un
compte existant du backend (table `user` / `auth_user`).

## Configuration

Variables d'environnement (`.env.local`) :

| Variable | Description | Défaut |
|---|---|---|
| `BACKEND_API_BASE_URL` | Racine versionnée de l'API, **côté serveur uniquement** (jamais envoyée au navigateur) | `http://127.0.0.1:3337/chatbot-backend/api/v1` |
| `NEXT_PUBLIC_API_BASE_URL` | Chemin appelé par le navigateur — un chemin **relatif** qui passe par le Route Handler proxy (voir section suivante) | `/api/backend` |
| `NEXT_PUBLIC_SOCKET_URL` | URL du serveur socket.io (chat temps réel) | `http://127.0.0.1:3337/ws` |
| `NEXT_PUBLIC_APPLICATION_ID` | Valeur de l'en-tête `x-application-id` (optionnel selon votre config backend) | vide |

Le vrai host/port du backend ne vit que dans `BACKEND_API_BASE_URL` (lu
uniquement par du code serveur) ; ne le préfixez jamais par `NEXT_PUBLIC_`,
sous peine de le faire fuiter dans le bundle JS envoyé au navigateur.

## Proxy authentifié (BFF) : masquer le host/port réel du backend **et** le JWT

Le navigateur n'appelle jamais directement `http://127.0.0.1:3337/...`, et ne
manipule plus jamais le JWT en clair. Il appelle un chemin relatif du même
domaine, `/api/backend/...` (`NEXT_PUBLIC_API_BASE_URL`, consommé par
`src/lib/api-client.ts`), qui est en réalité un **Route Handler** Next.js
(`src/app/api/backend/[...path]/route.ts`, pattern *Backend-For-Frontend*) et
non plus un simple `rewrites()` :

```ts
// src/app/api/backend/[...path]/route.ts (simplifié)
const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
if (token && !isLogin) {
  headers["x-user-claims"] = token;
  headers["Authorization"] = `Bearer ${token}`;
}
const backendRes = await fetch(`${BACKEND_API_BASE_URL}/${path}`, { method, headers, body });
```

Ce Route Handler tourne côté serveur : il lit le JWT dans un cookie
`httpOnly` (jamais accessible en JavaScript navigateur), l'injecte lui-même
dans les en-têtes `x-user-claims` / `Authorization: Bearer` avant de relayer
la requête vers le vrai backend, puis renvoie la réponse au navigateur.
Conséquence : ni le host/port réel du backend, ni le JWT, n'apparaissent
jamais dans le JavaScript livré au navigateur ni dans les requêtes réseau
visibles depuis les DevTools — seul `/api/backend/...` (sans en-tête
d'autorisation visible) y est visible. Pour changer de backend, il suffit de
modifier `BACKEND_API_BASE_URL` : aucun changement côté client.

Cas particuliers gérés par ce même Route Handler :
- **`POST /api/backend/auth/login`** : à la connexion réussie, il pose le
  cookie `chatbot_session_token` (`httpOnly`, `sameSite: "lax"`, `secure` en
  prod, 7 jours) et **retire** du corps de la réponse renvoyé au navigateur
  les champs `token` / `accessToken` / `jwt` — le client ne les voit jamais.
- **`POST /api/backend/auth/logout`** : supprime le cookie de session.

## Rendu côté serveur (SSR) des pages CRUD

Chaque page de ressource (`/users`, `/roles`, `/access`, `/branches`,
`/settings`, `/erp-connections`, `/tickets`) est désormais scindée en deux
fichiers :

- **`page.tsx`** — Server Component `async` : va chercher la première page
  de données directement depuis le serveur, via `fetchServer()`
  (`src/lib/server/backend-client.ts`), qui appelle **directement**
  `BACKEND_API_BASE_URL` (pas besoin de passer par le proxy public : le
  serveur n'a pas besoin de se cacher son propre backend) en s'authentifiant
  avec le cookie de session (voir section suivante). En cas d'échec (pas de
  session, backend indisponible), le composant se contente de passer
  `initialData: undefined` — le client rechargera lui-même la liste.
- **`<Entity>PageClient.tsx`** — composant client (`"use client"`) qui reprend
  exactement la logique d'interactivité précédente (pagination, création,
  édition, suppression, modales) via `useResource(...)`, désormais capable
  d'accepter un `initialData` en troisième argument pour **sauter son premier
  fetch** au montage.

Résultat : le premier rendu de chaque page arrive déjà rempli (pas de
spinner initial, meilleur TTFB/SEO), et toute l'interactivité existante
(pagination, CRUD, modales) continue de fonctionner sans changement pour
l'utilisateur.

La page `/tickets` a un traitement plus léger : seul l'onglet par défaut
("Tous les tickets", page 1) est pré-rempli côté serveur, car c'est le seul
dont la requête ne dépend d'aucun filtre ni état d'UI préalable. Les autres
onglets (durée > 1 jour, achat direct, achat direct & comptant) restent
chargés entièrement côté client au changement d'onglet, comme avant.

Le tableau de bord (`/`) suit le même principe mais sans page client
associée : il est 100 % Server Component (les 4 compteurs et le prénom de
l'utilisateur sont récupérés en parallèle avec `Promise.all` avant le rendu).

## Pont de session pour le SSR authentifié

Le JWT est émis par le backend et conservé **uniquement** dans le cookie
`httpOnly` `chatbot_session_token` (voir section précédente) — jamais dans le
`localStorage`, jamais lisible par du JavaScript navigateur. Un Server
Component n'a pas non plus accès à `localStorage`, ce qui tombe bien : le
cookie httpOnly, envoyé automatiquement par le navigateur sur toute requête
same-origin, sert à la fois au SSR et aux appels REST client-side.

- Le cookie est posé/supprimé **uniquement** par
  `src/app/api/backend/[...path]/route.ts` (branches `auth/login` /
  `auth/logout`) — il n'y a plus de Server Action dédiée
  (`session-actions.ts` a été retiré).
- Les thunks Redux `loginUser` / `logoutUser`
  (`src/lib/store/slices/authSlice.ts`) ne manipulent plus aucun jeton
  directement : `loginUser` appelle simplement `POST /auth/login` (qui pose
  le cookie côté Route Handler) et `logoutUser` appelle `POST /auth/logout`
  (qui le supprime).
- `src/lib/server/backend-client.ts` (`fetchServer`, utilisé par les Server
  Components pour le SSR) lit ce même cookie via
  `(await cookies()).get("chatbot_session_token")` et l'envoie au backend en
  `x-user-claims` + `Authorization: Bearer`, exactement comme le fait le
  Route Handler `api/backend/[...path]` côté client.

## Aucun cache client du profil utilisateur

Le profil (`session`) et la matrice de permissions (`abilities`) renvoyés par
le backend ne sont conservés **que dans le store Redux, en mémoire** —
`src/lib/store/slices/authSlice.ts` n'écrit plus rien dans `localStorage`
(l'ancienne clé `chatbot.auth.session` a été retirée). Conséquence directe :
en ouvrant l'onglet Application/Storage des DevTools du navigateur, on ne
trouve plus aucune trace du nom d'utilisateur, du rôle ou des permissions de
la personne connectée — ni le JWT (déjà masqué, voir plus haut), ni le reste
du profil.

La contrepartie : à chaque chargement complet de page, `hydrateSession()`
doit systématiquement rappeler `GET /auth/user` (authentifié par le cookie
httpOnly) pour reconstruire cet état — il n'y a plus d'affichage optimiste
immédiat à partir d'un cache. `RouteGuard` affiche un court indicateur de
chargement le temps de cette requête.

## Gestion des permissions (CASL) — port de l'ancien projet

Comme dans `chatbot-backoffice`, les permissions sont gérées avec
[`@casl/ability`](https://casl.js.org), à partir de la matrice `abilities`
renvoyée par le backend (`POST /auth/login`, `GET /auth/user`) — un tableau
de règles brutes `{ action, subject, conditions? }` directement consommable
par CASL (voir `AbilityRule` dans `src/lib/types.ts`).

- `src/lib/permissions/ability.ts` — port de `src/configs/acl.ts` +
  `src/configs/Action.tsx` de l'ancien projet :
  - `buildAbilityFor(rules)` construit l'objet `Ability` CASL
    (`ability.can(action, subject)`) ;
  - `UserAction` (`manage`, `create`, `read`, `edit`, `delete`, `stream`) et
    `EntityAbility` (`USER`, `ROLE`, `BRANCH`, `SETTING`, `TICKET`,
    `EXPORTER`, + `ACCESS` et `ERPCONNECTION`, ajoutées pour les ressources
    propres à ce projet et absentes de l'ancien) reprennent les mêmes
    valeurs de `subject`/`action` que l'ancien projet, pour rester
    compatibles avec la configuration de rôles déjà en place côté backend.
- `src/lib/permissions/AbilityContext.tsx` — équivalent de
  `layouts/components/acl/Can.tsx` + `AclGuard.tsx` de l'ancien projet, sans
  la dépendance `@casl/react` (incompatible avec React 19 au moment de ce
  portage — le composant `<Can>` ci-dessous la remplace en quelques lignes) :
  - `<AbilityProvider>` construit l'ability depuis `state.auth.abilities`
    (Redux) et la fournit via React Context — monté dans
    `app/(dashboard)/layout.tsx`, donc disponible sur toutes les pages
    protégées ;
  - `useAbility()` renvoie l'objet CASL courant ;
  - `usePermission(action, subject)` — raccourci booléen ;
  - `<Can action="create" subject={EntityAbility.USER}>...</Can>` — rendu
    conditionnel déclaratif, avec un `fallback` optionnel.
- **Sidebar** (`src/components/layout/Sidebar.tsx`) : chaque lien (hors
  Tableau de bord / Chat, toujours visibles) porte désormais une paire
  `action`/`subject` et n'apparaît que si `ability.can(...)` — port du même
  principe que `src/navigation/menu.config.ts` de l'ancien projet.
- **Pages CRUD** (`Users`, `Roles`, `Access`, `Branches`, `Settings`,
  `ErpConnections`, `Tickets`) : chaque `*PageClient.tsx` vérifie
  `ability.can("read", Subject)` en tête de rendu et affiche
  `<NotAuthorized />` (port de `src/pages/401.tsx`) si absent ; le bouton
  "Nouveau..." est enveloppé dans `<Can action="create" ...>`, et les boutons
  Éditer/Supprimer de chaque ligne dans `<Can action="edit" ...>` /
  `<Can action="delete" ...>`.

Ce n'est qu'une couche d'ergonomie côté client (masquer ce que l'utilisateur
ne peut pas faire) : le backend reste la seule source de vérité — s'il
refuse une action, le front affichera l'erreur renvoyée (`ApiError`) même si
un bouton était visible à tort.

## ⚠️ Point d'attention : JWT — la seule exception (socket.io)

Le JWT ne quitte le serveur que dans un cas précis et volontaire : la
poignée de main du socket.io. Le gateway socket du backend authentifie une
connexion via un payload explicite `auth: { token }` envoyé au moment du
`io(url, { auth: { token } })` (voir section « Chat en temps réel »
ci-dessous), et non via un cookie — il faut donc bien un jeton lisible en
JavaScript à cet instant précis.

Ce besoin est isolé au minimum : `src/app/api/auth/socket-token/route.ts`
lit le cookie `httpOnly` côté serveur et renvoie `{ token }` **uniquement**
à la demande, juste avant l'ouverture du socket
(`src/lib/hooks/useChatConversations.ts`, `fetchSocketToken()`). Ce jeton
n'est **jamais persisté** côté client (ni `localStorage`, ni variable
globale durable) : il est récupéré, utilisé immédiatement pour l'appel
`initSocket(token)`, puis oublié — une nouvelle connexion socket en
redemande un nouveau.

Le document Swagger du backend décrit par ailleurs les endpoints REST
protégés comme exigeant un en-tête `x-user-claims` (« Authenticated user
JWT »), sans préciser où ce jeton est renvoyé par `POST /auth/login` (le
corps de réponse ne documente que `{ session, abilities }`). Le Route
Handler `api/backend/[...path]` gère cette ambiguïté de façon défensive à la
connexion (recherche du jeton dans `token` / `accessToken` / `jwt` du corps,
puis dans les en-têtes `x-user-claims` / `x-auth-token` / `Authorization`) —
voir la fonction `extractToken` dans ce Route Handler. **Si votre backend
utilise un autre mécanisme**, ajustez `extractToken()` à cet endroit.

## State management : Redux Toolkit

L'état global (session utilisateur, notifications) est géré par un store
Redux (`@reduxjs/toolkit` + `react-redux`), et non par de simples React
Context :

```
src/lib/store/
  store.ts              makeStore() — un store par instance d'app (App Router)
  StoreProvider.tsx      <Provider> client, monté dans app/layout.tsx
  hooks.ts               useAppDispatch / useAppSelector typés
  slices/
    authSlice.ts          session, abilities, isLoading + thunks
                          (hydrateSession, loginUser, logoutUser,
                           changePasswordThunk, switchBranchThunk)
    toastSlice.ts          file de notifications (pushToast / removeToast)
```

`src/context/AuthContext.tsx` et `src/context/ToastContext.tsx` sont
conservés comme **façades** : ils exposent toujours `useAuth()` / `useToast()`
avec la même signature qu'auparavant, mais lisent et modifient désormais le
store Redux en interne (via `useAppSelector` / `useAppDispatch` +
`dispatch(...).unwrap()` pour propager les `ApiError` aux formulaires). Aucune
page ne dépend donc directement de Redux — mais l'état est bien centralisé
dans le store, inspectable avec les Redux DevTools du navigateur.

Pour ajouter un nouveau domaine d'état global (ex: un panier, des filtres
partagés) : créez un slice dans `lib/store/slices/`, ajoutez-le au
`reducer` de `makeStore()` dans `store.ts`, puis consommez-le avec
`useAppSelector` / `useAppDispatch`.

## Ce qui est branché sur l'API réelle

Toutes les routes du Swagger sont couvertes (voir `src/lib/resources/`) :

- **Auth** : `/auth/login`, `/auth/user`, `/auth/logout`,
  `/auth/change-password`, `/auth/switch/:branchId`.
- **CRUD standard** (liste paginée + créer/modifier/supprimer) : `/user`,
  `/role`, `/access`, `/branch` (+ `/branch/list/select`,
  `/branch/:id/user`), `/setting`, `/erpconnection`.
- **Tickets** (lecture seule) : `/ticket`, `/ticket/:id` (détail + relations),
  `/ticket/duration-over-one-day`, `/ticket/direct-purchase`,
  `/ticket/direct-and-cash-purchase` (avec filtres) — voir section dédiée
  ci-dessous.
- **Chat** : temps réel via **socket.io** (voir section dédiée ci-dessous),
  interface façon ChatGPT multi-conversations avec choix d'entité obligatoire
  et affichage des données structurées (stats, tableau) renvoyées par le
  dernier message assistant.

### Note sur le modèle `Ticket`

Le document Swagger référence un schéma `#/components/schemas/Ticket` qui
n'est **pas effectivement déclaré** dans `components.schemas` (bug côté
backend / modèle non enregistré auprès de Swagger). Le type `Ticket` dans
`src/lib/types.ts` a donc été reconstitué à partir des noms de filtres
exposés par `GET /ticket/direct-and-cash-purchase` ; il est volontairement
permissif (`[key: string]: unknown`). Si vous avez accès au vrai modèle côté
backend, mettez à jour ce type pour un typage plus strict.

## Tickets : colonnes, filtres et détail

L'onglet « Achat direct & comptant » (`GET /ticket/direct-and-cash-purchase`)
expose désormais la quasi-totalité des filtres documentés par le Swagger sur
cet endpoint (`TicketDirectAndCashPurchaseFilters` dans `lib/types.ts`) :
N° ticket, bon d'enlèvement, N° régime, N° transport, ticket planteur, code
et nom planteur, code article, camion, nom chauffeur, code et nom
transporteur, référence transporteur, origine, type opération, type ticket,
état payé régime/transport et statut de solde. Les champs dont le backend ne
documente pas les valeurs possibles (`typeOperation`, `ticketType`,
`statePaid`, `stateTransportPaid`, ...) restent des champs texte libres
plutôt que des listes déroulantes, faute de connaître leur domaine exact.

Le tableau (tous onglets confondus, `baseColumns` dans
`TicketsPageClient.tsx`) affiche également plus de colonnes qu'auparavant :
bon d'enlèvement, type opération, chauffeur, code article, N° régime, N°
transport, poids d'entrée/sortie, montant transport à payer et état régime
caisse s'ajoutent aux colonnes déjà présentes. Le tableau défile
horizontalement (`overflow-x-auto`) au-delà de la largeur de l'écran.

Chaque ligne a désormais un bouton « œil » qui ouvre `TicketDetailModal`
(`src/components/resources/TicketDetailModal.tsx`) : le détail complet du
ticket, organisé en sections (Identification, Acteurs & transport, Pesée,
Règlement régime, Règlement transport, Relations, Suivi). Ce détail est
récupéré via `ticketsApi.get(id)`, qui appelle `GET /ticket/:id` avec
`?relations[]=branch&relations[]=station&...` — la même liste de relations
que l'ancien projet (`chatbot-backoffice`,
`src/pages/api/ticket/[id].tsx`) : succursale, station, article, client,
fournisseur, transporteur, emballage, exportateur, marque, destination,
origine, magasin, plus les sous-objets `ticketSupinfo`/`ticketBoarding`/
`ticketDocument`. La ligne cliquée s'affiche immédiatement (déjà en mémoire
depuis la liste) pendant que ce détail complet se charge en arrière-plan.

Comme les schémas de ces relations ne sont pas documentés par le Swagger
(voir note ci-dessous sur le modèle `Ticket`), `RelationRef` (`lib/types.ts`)
reste volontairement permissif et `TicketDetailModal` affiche au mieux
`displayName`/`name`/`code`/`id` selon ce qui est présent.

La page `/tickets` reste gouvernée par la même permission CASL que le reste
de l'application (`ability.can("read", EntityAbility.TICKET)`, voir section
« Gestion des permissions » ci-dessous) : liste, filtres et détail sont tous
masqués derrière ce même contrôle d'accès — il n'y a pas de permission
séparée pour consulter le détail d'un ticket.

### Note sur le rôle ↔ accès

`GET /role` ne renvoie pas le détail des `accessToRoles` associés (il faudrait
probablement `relations[]=accessToRoles` côté backend). Le formulaire de
modification d'un rôle (`RoleFormModal`) réaffiche donc une liste d'accès
vide à l'édition — sauvegarder recrée la liste depuis zéro. Ajustez si votre
backend expose cette relation.

### Matrice de permissions du rôle (entité × permission)

En plus de la liste « Accès associés » existante (`accessToRoles` :
guest/manager/admin/owner par `Access`), `RoleFormModal` affiche désormais un
second bloc, « Permissions par entité » : un tableau croisé avec une entité
CASL par ligne (`Utilisateurs`, `Rôles`, `Accès`, `Succursales`, `Tickets`,
`Connexions ERP`, `Paramètres`, `Exports`, plus une ligne `Global (toutes
entités)` pour `EntityAbility.All`) et une action par colonne (`Lire`,
`Créer`, `Modifier`, `Supprimer`, `Gérer (tout)`, `Diffuser` — les valeurs de
`UserAction`). Cocher une case construit le JSON envoyé dans
`CreateRoleDto.permissions` / `UpdateRoleDto.permissions` (déjà présent dans
`lib/types.ts`), sous la forme `{ [entité]: { [action]: booléen } }`.

- `src/lib/permissions/permission-matrix.ts` : `MATRIX_ENTITIES` /
  `MATRIX_ACTIONS` (lignes/colonnes affichées), `buildEmptyPermissionMatrix()`,
  `permissionsToMatrix(json)` (JSON → matrice affichée, tolérant à toute forme
  inattendue) et `matrixToPermissions(matrice)` (matrice → JSON à sauvegarder).
- `src/components/resources/PermissionMatrix.tsx` : le tableau lui-même
  (checkboxes + une case "Tout" par ligne pour cocher toute la ligne d'un
  coup).
- **Pré-remplissage depuis le défaut** : pour un **nouveau** rôle, dès que la
  liste des `Access` est chargée, la matrice est initialisée depuis les
  permissions de l'`Access` dont le nom vaut `default` (comparaison
  insensible à la casse/espaces via `findDefaultAccess()`), tant que
  l'utilisateur n'a pas encore modifié une case à la main — c'est la demande
  « LE TABLEAU DE PERMISSION BASEE SUR LE DEFAULT DE ACCESS ». Un bouton
  « Réinitialiser depuis le défaut » permet de revenir à cet état à tout
  moment. Pour un rôle **existant**, la matrice part plutôt de
  `role.permissions` (si le backend le renvoie sur `GET /role`), le défaut
  n'intervenant que pour une création.
- Cette matrice est indépendante du contrôle d'accès CASL de l'interface
  elle-même (`ability.can(...)`, section « Gestion des permissions »
  ci-dessus) : elle sert à **construire** les permissions d'un rôle côté
  backend, pas à en appliquer une côté front. Si votre backend attend une
  autre forme pour `Role.permissions` (par exemple un tableau de règles CASL
  `{action, subject}[]` plutôt qu'un objet imbriqué), adaptez
  `matrixToPermissions()`/`permissionsToMatrix()` en conséquence — le reste du
  composant (tableau, pré-remplissage, bouton de reset) n'a pas besoin de
  changer.

## Chat en temps réel (socket.io)

Le chat n'utilise plus de requête REST (`POST /chat`) : il est branché en
temps réel sur le même serveur socket.io que l'ancien projet
`chatbot-backoffice`, avec exactement le même contrat d'événements pour
rester compatible avec le backend existant.

- **Connexion** (`src/lib/socket/socket-service.ts`) :
  `io(NEXT_PUBLIC_SOCKET_URL, { auth: { token }, transports: ["websocket"], reconnection: true, reconnectionAttempts: 5, reconnectionDelay: 1000 })`.
  Le `token` est obtenu à la demande via `fetchSocketToken()` (voir section
  précédente sur l'exception JWT) — jamais lu depuis un stockage client.
- **Contrat d'événements** (`src/lib/hooks/useChatConversations.ts`,
  `CHAT_SOCKET_EVENTS`) :
  - `chat:message` (émis par le client, avec `{ conversationId, content, entity }`) ;
  - `chat:message:chunk` (reçu, delta de streaming du message assistant) ;
  - `chat:message:done` (reçu, message final + éventuel
    `data: { stats?, table? }` affiché par `ChatDataPreview`) ;
  - `chat:error` (reçu, erreur applicative).
- **Choix d'entité obligatoire avant de démarrer une conversation**
  (`src/lib/chat-scopes.ts`, `ChatScopePicker.tsx`) : chaque nouvelle
  conversation démarre comme un brouillon vide affichant un écran de
  sélection (`ChatScopePicker`) parmi les entités disponibles (Général,
  Ticket, Exporter — valeurs `entity` reprises de l'enum `EntityAbility` de
  l'ancien projet). Tant qu'aucune entité n'a été choisie, la zone de saisie
  du chat reste désactivée ; une fois choisie, la conversation brouillon est
  reciblée en place (même mécanisme que l'ancien projet) et le champ de
  message est débloqué. Le sidebar affiche l'entité de la conversation active
  en lecture seule (elle ne peut plus être changée après coup).
- **Domaines filtrés par permission** : `getAvailableChatScopes(ability)`
  (`src/lib/chat-scopes.ts`, port direct de la fonction homonyme de l'ancien
  projet) ne propose un domaine métier (Tickets, Export) dans
  `ChatScopePicker` que si l'utilisateur a la permission `stream` sur
  l'entité correspondante (`ability.can("stream", EntityAbility.TICKET)`,
  etc. — voir la section « Gestion des permissions (CASL) » ci-dessous). Le
  scope "Général" reste toujours proposé, comme dans l'ancien projet.

## Validation côté client (Yup)

Le formulaire de connexion et les 6 modales CRUD (Utilisateur, Rôle, Accès,
Succursale, Paramètre, Connexion ERP) valident désormais leurs champs avec
**Yup** avant tout appel API :

- `src/lib/validation/schemas.ts` — un schéma Yup par formulaire
  (`loginSchema`, `buildUserSchema(isEditing)` — le mot de passe n'est
  obligatoire qu'à la création —, `roleSchema`, `accessSchema`,
  `branchSchema`, `settingSchema`, `erpConnectionSchema`). `accessSchema`
  valide en plus que les champs `entityJson` / `permissionsJson` contiennent
  du JSON syntaxiquement valide.
- `src/lib/validation/validate.ts` — `validateForm(schema, values)` exécute
  le schéma avec `abortEarly: false` et renvoie une map `{ champ: message }`
  directement compatible avec la prop `error` des composants
  `Input` / `Select` / `Textarea` (`components/ui/Input.tsx`) ; un objet vide
  signifie formulaire valide.
- Chaque modale suit le même pattern : un état `errors`, une fonction
  `handleSubmit` qui appelle `validateForm(...)`, affiche les erreurs sous
  les champs concernés et n'appelle `onSubmit` que si `errors` est vide. La
  validation se déclenche explicitement au clic sur « Enregistrer » (pas de
  `react-hook-form`, formulaires en état contrôlé classique via `useState`).

## Structure du projet

```
src/
  app/
    login/                 page de connexion (hors layout dashboard)
    (dashboard)/            layout protégé (sidebar + topbar) + pages
      page.tsx              tableau de bord (Server Component, 100% SSR)
      chat/                 interface de chat temps réel (socket.io)
                             page.tsx, ChatSidebar.tsx, ChatScopePicker.tsx,
                             ChatMessageBubble.tsx
      users/                page.tsx (Server Component) + UsersPageClient.tsx
      roles/                page.tsx (Server Component) + RolesPageClient.tsx
      access/               page.tsx (Server Component) + AccessPageClient.tsx
      branches/              page.tsx (Server Component) + BranchesPageClient.tsx
      settings/              page.tsx (Server Component) + SettingsPageClient.tsx
      erp-connections/       page.tsx (Server Component) + ErpConnectionsPageClient.tsx
      tickets/               page.tsx (Server Component, onglet par défaut) + TicketsPageClient.tsx
      profile/              changement de mot de passe + succursale
  components/
    ui/                     Button, Input, Modal, DataTable, etc.
    layout/                 Sidebar, Topbar, RouteGuard
    resources/              Modales de formulaire par entité + preview chat
                             + TicketDetailModal.tsx (détail lecture seule)
  context/
    AuthContext.tsx         façade useAuth() / AuthProvider (branchée sur Redux)
    ToastContext.tsx        façade useToast() / ToastProvider (branchée sur Redux)
  lib/
    api-client.ts           wrapper axios (headers, pagination, erreurs) — client uniquement,
                             ne manipule plus aucun jeton (cookie httpOnly envoyé automatiquement)
    api-error.ts            classe ApiError (isomorphe : utilisée côté client et serveur)
    query-string.ts         construction des query strings (isomorphe)
    config.ts               API_BASE_URL (= /api/backend), SOCKET_URL, APPLICATION_ID
    types.ts                types générés depuis le Swagger du backend
    resources/              un client par ressource (users, roles, ...) — côté client
    hooks/
      useResource.ts        hook générique liste + CRUD + pagination (accepte un initialData SSR)
      useChatConversations.ts  hook socket.io : conversations, streaming, timeouts
    chat-scopes.ts          ChatScope, GENERAL_SCOPE, CHAT_SCOPES (entités du chat)
    socket/
      socket-service.ts     initSocket()/closeSocket()/fetchSocketToken()
    validation/
      schemas.ts            schémas Yup par formulaire
      validate.ts           validateForm() — exécute un schéma, renvoie { champ: message }
    permissions/
      ability.ts            buildAbilityFor(), UserAction, EntityAbility (CASL)
      AbilityContext.tsx     <AbilityProvider>, useAbility(), usePermission(), <Can>
    store/                  store Redux Toolkit (voir section dédiée ci-dessus)
    server/
      backend-client.ts     fetchServer() — appelle BACKEND_API_BASE_URL directement,
                             authentifié via le cookie de session (import "server-only")
  app/api/
    backend/[...path]/route.ts   Route Handler BFF — proxy authentifié (voir section dédiée)
    auth/socket-token/route.ts   renvoie { token } à partir du cookie httpOnly (usage socket uniquement)
```

## Lint & build

```bash
npm run lint
npm run build
```

Les deux passent sans erreur sur ce template. Une règle ESLint
(`react-hooks/set-state-in-effect`, très stricte sur tout `setState` dans un
`useEffect`) a été volontairement désactivée dans `eslint.config.mjs` : le
template synchronise l'état d'un formulaire avec la ressource éditée via
`useEffect` (pattern React classique). Pour une application plus large,
envisagez plutôt un remount par `key`, ou une librairie de data-fetching
(SWR, TanStack Query).

## Aller plus loin

- Ajouter une vraie gestion d'erreurs de validation par champ renvoyées par
  le **backend** (le backend renvoie `errors: { champ: string[] }` sur 400 —
  voir `ApiError.fieldErrors` dans `src/lib/api-client.ts`) en complément de
  la validation Yup côté client, qui ne couvre que les erreurs détectables
  avant l'appel API.
- Le gating CASL actuel (sidebar, pages CRUD, scopes de chat) ne couvre que
  la permission `read`/`create`/`edit`/`delete`/`stream` sur l'entité
  entière ; les `conditions` par règle (ex: restreindre à une succursale)
  sont transmises à CASL (`ability.can(action, subject)` les respecte déjà
  pour un sujet objet) mais aucune page n'inspecte encore les objets un par
  un avec leurs champs (`ability.can("edit", subjectObj)` plutôt que
  `subject: string`) — à affiner si le backend exploite des `conditions`
  fines par rôle.
- Ajouter des tests (Playwright pour les parcours, Vitest pour `lib/`),
  notamment pour le nouveau Route Handler BFF et le flux socket.io.
