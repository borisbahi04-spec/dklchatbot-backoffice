
## Module « Engrais & plants » (ADR-002, 23/10/2026)

Ce module rapproche une liste de planteurs (ENGRAIS ou PLANTS) avec l'export Business Central « Factures achat enregistrées ». Les deux catégories ont chacune leur propre traitement. Aucune donnée BC n'est lue ni modifiée en base : seuls les fichiers importés sont utilisés.

### Installation et exécution

```bash
# backend (chatbot-backend)
yarn install                 # ajoute jszip, déjà présent via exceljs
yarn start:dev
yarn test:engrais-plants     # 34 tests : moteur, lecture xlsx/ods/csv, service

# frontend (chatbot-frontend)
npm install
npm run dev                  # menu « Engrais & plants » → /engrais-plants
```

Aucun script SQL n'est nécessaire, car tout est gardé en mémoire.

Pour donner l'accès à un rôle non-admin, cochez « Lire » sur la ligne « Engrais & plants » dans le formulaire de rôle. Le sujet CASL correspondant est `PlanterReconciliation`.

### Utilisation

1. Ouvrez l'onglet **Traitement ENGRAIS** ou **Traitement PLANTS**. Chaque espace garde ses propres fichiers et résultats.
2. Importez la liste des planteurs : code planteur, nom et prénoms, montant net à payer. Formats acceptés : .xlsx, .ods ou .csv.
3. Importez les factures d'achat enregistrées (export BC).
4. Vérifiez la correspondance des colonnes et l'aperçu, puis choisissez l'année et les règles : types d'opération, codes magasin, factures clôturées et correctives.
5. Cliquez sur **Analyser**, consultez les résultats et téléchargez les fichiers :
   - `01_<Catégorie>_Sans_Facturation.xlsx` ;
   - `02_<Catégorie>_Avec_Facturation.xlsx` ;
   - `03_<Catégorie>_Anomalies.xlsx`.

Changer un fichier, une colonne, l'année ou une règle efface le résultat affiché : il faut relancer l'analyse. Les traitements récents restent consultables pendant 2 heures.

### Règles de rapprochement (confirmées sur les fichiers réels)

- **Catégorie** : elle vient uniquement de la liste importée. L'export BC ne contient que le type « ACHAT MENSUEL » et aucun champ engrais ou plants.
- **Rapprochement** : code planteur = « N° fournisseur », comparaison stricte (espaces retirés, majuscules). Aucune correspondance n'est faite sur le nom ; un nom différent est seulement signalé.
- **Mois** : mois de la « Date comptabilisation ».
- **Montant** : « Montant à payer » (jamais Montant + Montant TTC). Une autre colonne peut être choisie à l'écran.
- **Factures exclues** :
  - factures annulées : toujours exclues ;
  - factures clôturées : conservées par défaut (option) ;
  - factures correctives : conservées par défaut (option).
- **Filtres par défaut** : type d'opération = ACHAT MENSUEL, tous les codes magasin. Ils sont modifiables pour chaque catégorie.
- **Calculs** : total annuel = somme des 12 mois ; écart = montant net à payer − total annuel facturé.
- **Doublons dans la liste** : fusionnés en une seule ligne (montants additionnés) et signalés.
- **Facture en double (même N°)** : comptée une seule fois.
- **Dates ou montants illisibles** : la facture n'est pas comptée et elle est signalée.
- **Factures de fournisseurs absents de la liste** : jamais attribuées. Elles sont listées, par fournisseur, dans la feuille « Factures hors liste » du fichier 03.

### API

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/planter-reconciliation/files` | multipart `file`, `category`, `kind` (`planters` ou `invoices`) : lecture, détection de l'en-tête et des colonnes, aperçu |
| POST | `/planter-reconciliation/runs` | `{ category, year, plantersFileId, invoicesFileId, plantersMapping?, invoicesMapping?, rules? }` |
| GET | `/planter-reconciliation/runs?category=` | historique de l'utilisateur |
| GET | `/planter-reconciliation/runs/:id` | détail d'un traitement |
| GET | `/planter-reconciliation/runs/:id/download?type=` | `withoutBilling`, `withBilling` ou `anomalies` |

### Fichiers

- **Backend** :
  - `src/modules/analyse/services/planter-reconciliation/` : `engine` (règles), `reader` (xlsx, ods, csv), `service`, specs ;
  - `controllers/planter-reconciliation/` ;
  - `dto/planter-reconciliation/` ;
  - `core/definitions/enums.ts` ;
  - `common/data/access.json.ts`.
- **Frontend** :
  - `app/(dashboard)/engrais-plants/` ;
  - `components/resources/PlanterReconciliationWorkspace.tsx` ;
  - `lib/resources/planter-reconciliation.ts` ;
  - `Sidebar.tsx` ;
  - `ability.ts` ;
  - `permission-matrix.ts`.
