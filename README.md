# paragone

## Intro

`paragone` analyse des fichiers JavaScript/TypeScript, en extrait des morceaux potentiellement vulnérables de code, et analyse ces derniers afin de découvrir la source d'un identifiant.

Exemple, un sink :

```js
t.innerHtml = '<div>' + r + </div>
```

Une fois l'analyse terminée, la source :

```js
const r = document.getElementById('name').value
```

Le programme est expliqué plus en détail ici : `## Qu'est-ce que c'est ?`

## Installer

Les dépendances :

```bash
bun install
```

Pour installer la CLI globalement :

```bash
bun link
```

## Environnement

Ce projet utilise une IA de type `System One`, un paradigme décisionnel basé sur les probabilités.

En l'occurrence, il s'agit de `jev`, développé par TypeSafe.

Plus d'infos [ici](https://docs.typesafe.ai/introduction).

Une clé est donc nécessaire.

```bash
JEV_API_KEY=…
```

Normalement, toute IA compatible avec le client de TypeSafe devrait fonctionner, mais cela n'a pas été testé.

## Aide (`--help`)

```bash
paragone : triage statique de vulns client-side sur bundles JS et analyse du potentiel de vulnérabilité grâce à un juge de type 'System One'.

Utilisation : paragone [--analyze PATH] [options]

OPTIONS
  -a, --analyze <chemin>, aucune valeur par défaut. Dossier OU fichier à scanner. Ne scanne pas les dossiers vendors.
  -s, --scan, défaut à 'false'.                     Lance le scan du dossier. Ne supprime aucune donnée pré-existante.
  -j, --judge, défaut à 'false'                     Lance le juge pour ce run. Ne supprime aucune donnée pré-existante.
  -b, --batch, défaut à '1'                         Nombre de "dossier(s)" à envoyer au juge.
  -c, --classes                                     Analyse une ou plusieurs classe(s) de vulnérabilité. Insensible à la casse.
    <cspt,xss,code_exec,                            Exemple : 'paragone (...) -c cspt -c XSS' ou "paragone (...) -c cspt,xss".
    open_redirect,web_message,all>
    , défaut à 'all'.
  -r, --reset, défaut à 'false'                     ATTENTION ! Destructif. DETRUIT la base de donnée, et FORCE une réanalyse du corpus. Pour juger, l'option '--judge' est nécessaire.
                                                    Si la commande est lancée sans TTY '--noninteractive' est obligatoire.
  --noninteractive, défaut à false                  Mode non-interactif, utile sans TTY de disponible, afin d'opérer un '--reset' sans demande de confirmation.
  -p, --project_name, défaut                        Le nom du projet.
    au nom du dossier courant
  --serve, défaut à 'false'                         Lance l'API (données de la base, contrat OpenAPI sur /openapi) une fois le scan et le juge demandés terminés.
                                                    Seul, il ne demande pas --analyze.
  --port <n>, défaut à '7331'                       Port d'écoute de l'API. Exige --serve.
  --host <adresse>, défaut à '127.0.0.1'            Adresse d'écoute de l'API. Une adresse non locale expose au réseau
                                                    /api/lead/:id/open (lance l'éditeur), /api/lead/:id/human (écrit en base), /api/config (change le dossier, les classes et le lot), /api/scan et /api/judge (lancent un travail). Exige --serve.
  --cors <origine>                                  Origine autorisée à appeler l'API depuis un autre site, par exemple
                                                    http://localhost:5173. Répétable ou séparée par des virgules ; aucune par défaut. Exige --serve.
  --public <dossier>                                Dossier servi à la racine de l'API (le front construit). Par défaut, la page factice livrée. Exige --serve.
  -h, --help                                        Affiche cette aide et quitte le programme.

CONFIGURATION
  Le dossier à analyser, les classes et le lot se règlent par ces arguments. Avec --serve, PUT /api/config les change ensuite en mémoire, le temps du service : rien n'est enregistré.

EXEMPLES:
    paragone -a ./example.com -s -j -c all          Pour l'ensemble des classe de vulnérabilité, analyse le dossier 'example.com', et passe le juge sur les données d'analyse.
    paragone -a ./example.com -s -j -c cspt --reset  Pour la classe 'cspt', REFAIT une analyse du dossier 'example.com', et REPASSE le juge sur les données d'analyse.
    paragone --serve                                 Lance l'API sur les données déjà en base.
    paragone -a ./example.com -s --serve --public ./dist --cors http://localhost:5173
                                                    Scanne, puis lance l'API qui sert aussi le front de ./dist, appelable depuis http://localhost:5173.
```

## Démarrage rapide

1. Installation
```bash
bun install && bun link
```

2. Allez dans un dossier de travail, par exemple `BugBounty/MegaCorp`.

`paragone` fonctionne avec du JavaScript beautifié, pas un oneliner de plusieurs milliers d'octets qui lévera une erreur. Prenez `jxscout` pour fetch vos données.

3. Optionnel - Clonez le repo `paragone-front`

```bash
git clone git@github.com:kibatche/paragone-front.git
```

Cela vous permettra d'avoir un front qui n'existe pas dans ce projet de base.

4. Lancez `paragone` sur votre dossier :

```bash
paragone --analyze ~/jxscout/megacorp/original/auth.megacorp.com/ --scan --judge --serve --classes all --project_name megacorpAnalysis
```

Cela lancera une analyse sur tous les fichiers JavaScript du dossier. En ressortiront des leads, sous forme de dossiers, qui seront envoyés à `jev`.

Vous pouvez maintenant accéder aux données soit via la base de données directement, soit via l'API (méthode conseillée pour les yeux).

### Vous n'avez pas de clé `jev` mais vous souhaitez tester

1. A partir de la racine de ce repo :

```bash
cp ./paragone_test_dir ./.paragone
```

2. (Optionnel mais conseillé) Clonez le repo [`paragone-front`](https://github.com/kibatche/paragone-front)

```bash
git clone git@github.com:kibatche/paragone-front.git
```

3. Lancez `paragone` dans le même dossier que là où se trouve la base de donnée factice

```bash
paragone --serve --public chemin/vers/paragone-front/public
```

Cela servira les données factices enregistrées dans cette base de données de test.

Au contraire d'une vraie BDD, cette dernière contient un chemin **factice**. L'affichage du code n'est donc pas possible.

## Qu'est-ce que c'est ?

L'idée de ce programme est partie d'un constat simple : je trouvais des CSPT à la main, et je me suis demandé si, après coup, on avait un moyen de le voir dans le code récupéré par  `jxscout`.

Spoil : oui, c'est possible.

Par exemple :

```js
bt.get(`/api/v1/users/${t}`)
```

Le code ci-dessous est une forme évidente de CSPT et on peut la détecter. L'identifiant `t`, quant à lui, est un `TemplateLiteral` dans le vocabulaire Babel.

On peut remonter à la source d'une variable de ce *sink*, afin de savoir si elle est éventuellement contrôlable.

Exemple :

```js
const t = new URLSearchParams(location.search).get('client_id')
```

Une première version rudimentaire a été écrite en juillet de cette année.

C'est devenu ensuite un ajout à [`jxscout`](https://github.com/francisconeves97/jxscout) de Francisco Neves qui, comme je l'ai découvert, proposait déjà une analyse des fichiers JavaScript, mais sans teinte des identifiants et avec le programme `oxc`.

Je trouvais judicieux de fusionner les deux, en migrant la partie de `jxscout` dédiée à l'analyse de `oxc` vers Babel, que je trouve bien mieux.

Mais au final l'idée de fusion s'est révélée mauvaise.

Gloire lui soit rendue malgré tout, c'est grâce à son programme que j'ai mis le pied à l'étriller *pour de bon*. Et on peut retrouver encore des traces de son programme et de sa structure dans `paragone`.

`paragone` est de nouveau devenu un standalone. Le travail dans `jxscout` à entièrement été revu à la hausse à tous les niveaux : qualité de détection des analyses, formes syntaxiques et un rework complet de la teinte de variable.

Le programme propose énormément de choses, il est donc très difficile de tout lister.

C'est en quelque sorte un remplaçant à l'analyse par expression régulière : en seulement quelques secondes, on peut découvrir de très nombreuses formes de vulnérabilité selon une classe donnée et avoir un indice de la dangerosité d'un identifiant présent au sein de cette forme grâce à `jev`. Le tout passe par l'AST d'un fichier JavaScript, ce qui rend le travail avec les données bien meilleur que de toutes autres façons.

La philosophie est celle du *code first*, et les LLM, quoique au départ assez présents, ont été virés au profit de `jev` qui correspond parfaitement au "rouage" qu'était alors les LLM dans ce programme (ils ne pouvaient pas écrire et ne faisaient qu'appeler des fonctions).

On peut voir aussi ce programme comme étant un centre de triage des leads. En effet, des centaines de leads peuvent être écrits et jugés, ce qui rend le tout assez conséquent à traiter. 

Le programme propose donc une API OpenAPI qui permet de faire ce que fait la CLI, mais avec la possibilité de placer un jugement humain en plus. Ce n'est pas grand chose, et les jugements de `jev` peuvent suffire.

Cependant, dans le cadre d'un RAG sur des données validées passées, ou d'un réentrainement d'un LLM `jev-like`, ça peut-être intéressant de normaliser les leads (enlever tout ce qui est spécifique, comme le nom des identifiants, et ne garde que la structure du sous-arbre de détection de la source).

Pour l'instant, il n'est pas possible de faire ce jugement via la CLI : il faudrait proposer une sorte de front pour le terminal, et cela ne se ferait qualitativement qu'avec un TUI, ce qui me demanderait trop de travail.

Plus d'infos dans la section `## La suite`.

### Qu'est-ce que ça n'est pas ?

C'est un programme d'analyse *statique*. Je vous invite à lire cette page wikipédia : [Théorème de Rice sur l'indécidabilité de l'arrêt](https://fr.wikipedia.org/wiki/Th%C3%A9or%C3%A8me_de_Rice).

`paragone` ne pourra pratiquement jamais garantir à 100% quelque chose : il ne donne que des probabilités. Tout est fait pour que ces dernières soient les plus utiles possibles, notamment grâce au paradigme décisionnel utilisé par les IA de type System One, et un système de scoring.

Cependant, le vrai test se fait à l'exécution. Il faut donc adjoindre les deux mondes : l'analyse statique permet de brosser rapidement certaines choses, l'analyse dynamique de les confirmer et d'en découvrir d'autres.

Je réfléchis à introduire une génération automatique de configuration pour l'outil [`domlogger++`](https://github.com/kevin-mizu/domloggerpp) de Kevin Mizu. Je ne sais pas si c'est une bonne idée, mais il y a moyen. L'implémentation n'est cependant pas trivial, les bibliothèque comme react étant bourrée de helper qui, in fine, seront des API propres au navigateur.

Une autre idée est d'implémenter un helper pour fournir un "Dossier" - le nom donné à toutes les informations concernant un identifiant - à un agent ou autre qui pourrait tester des chemins potentiels d'exécution dans un environnement favorable (MCP de Caido ou Burp).

Une autre idée encore serait de placer des sortes de points d'arrêt directement dans un fichier copie du fichier original. On pourrait y placer des fonctions arbitraires, ou encore des point de débogage. J'ai déjà testé l'idée avec un add-on Burp de mon côté, mais c'est un autre projet que celui-ci.

Sinon, on peut aussi utiliser notre cerveau ! :)

En un mot comme en cent, ce que ce projet n'est pas : un analyseur dynamique.
## Les analyseurs

## Liste

Ils sont de trois sortes : les analyseurs avec impact (CSPT, XSS etc.) et les analyseurs d'inventaire (localStorage, secret etc) et les sources.

Les sources n'offrent pas d'analyse en tant que telle, elles permettent juste de signifier lors d'une teinte que l'identifiant a une source nommée et connue. Cela aide à la décision.

Une bonne partie des analyseurs d'inventaire viennent de jxscout, même s'ils ont été remaniés. L'honnêteté oblige à le dire, il a vraiment fait un taff de fou pour lequel je dois beaucoup.

```
srcs/analyze/ast_analyzers/
├── code_exec
│   ├── dynamic_import.ts
│   ├── eval.ts
│   ├── function_constructor.ts
│   ├── lodash_template.ts
│   ├── script_element.ts
│   ├── string_timer.ts
│   └── worker.ts
├── cspt
│   ├── cspt_utils.ts
│   ├── http_clients.ts
│   ├── path_attribute_assignment.ts
│   └── url_object_expression.ts
├── inventory
│   ├── cookie.ts
│   ├── document_domain.ts
│   ├── graphql.ts
│   ├── hostname.ts
│   ├── local_storage.ts
│   ├── secrets
│   │   ├── regex_match.ts
│   │   ├── regex_pattern.ts
│   │   └── secrets.ts
│   ├── session_storage.ts
│   └── window_name.ts
├── open_redirect
│   ├── location.ts
│   ├── spa_navigation.ts
│   └── window_open.ts
├── sources
│   ├── check_sources.ts
│   ├── cookie.ts
│   ├── document_domain.ts
│   ├── local_storage.ts
│   ├── location.ts
│   ├── referrer.ts
│   ├── session_storage.ts
│   ├── url_search_params.ts
│   └── window_name.ts
├── web_message
│   ├── add_event_listener.ts
│   ├── onhashchange.ts
│   ├── onmessage.ts
│   └── postmessage.ts
└── xss
    ├── angular_bypass.ts
    ├── create_contextual_fragment.ts
    ├── create_object_url.ts
    ├── document_write.ts
    ├── html_property_call.ts
    ├── innerhtml_property.ts
    ├── inner_html.ts
    ├── insert_adjacent_html.ts
    ├── jquery.ts
    ├── outer_html.ts
    ├── parse_from_string.ts
    ├── react_dangerously_set_inner_html.ts
    ├── set_html_unsafe.ts
    ├── srcdoc.ts
    └── unsafe_html_wrapper.ts
```

## API (`--serve`)

`--serve` lance une API HTTP qui sert les données de `.paragone/findings.db` du dossier courant : leads, jugements, fichiers scannés, usage du juge.

### Lancer

Depuis le dossier qui contient `.paragone/` :

```bash
paragone --serve
paragone -a ./example.com -s --serve --port 8000
paragone --serve --public srcs/api/public --cors http://localhost:5173
```

Le troisième exemple sert la page factice du dépôt ; remplacer `srcs/api/public` par le dossier du front.

Aucun front n'est fourni dans ce repo. Vous pouvez trouver un front d'exemple là : https://github.com/kibatche/paragone-front

Pourquoi ? Car cela dépasse le cadre de ce projet et que l'imposition d'un front ne semble pas souhaitable.

- `paragone --serve` écoute sur `http://127.0.0.1:7331` et sert la base existante.
- Avec `--scan` ou `--judge`, ces deux actions se terminent avant que l'API écoute : elle sert des données à jour.
- `--host` change l'adresse. Une adresse non locale expose au réseau `POST /api/lead/:id/open` (lance l'éditeur), `/api/lead/:id/human` (écrit en base), `PUT /api/config` (change le dossier, les classes et le lot), `POST /api/scan` et `POST /api/judge` (lancent un travail) ; un avertissement s'affiche.

### Définitions OpenApi

Une fois l'API servie, vous pouvez accéder à `http://IP:PORT/openapi`. Les définitions de toutes les routes seront présentes. Vous pouvez également accéder `/openapi/json` pour la version JSON.

### Configurer et lancer un scan ou un juge

La configuration - dossier à scanner, classes à juger, taille des lots - est l'objet `config` de `srcs/config/config.ts`, celui que les arguments de la ligne de commande remplissent. `PUT /api/config` le change en mémoire, comme le ferait un script qui l'importe : rien n'est enregistré, et le prochain lancement repart des arguments. Depuis le dossier de `paragone` :

```bash
curl -s -X PUT http://127.0.0.1:7331/api/config -H "content-type: application/json" -d '{"analyze": "fake_js_dir", "classes": ["xss"], "batch": 2}'
curl -s -X POST http://127.0.0.1:7331/api/scan
curl -s http://127.0.0.1:7331/api/jobs
```

- `POST /api/scan` répond `202` avec un travail ; `GET /api/jobs` donne le travail en cours et le dernier terminé, avec son avancement et son bilan.
- `POST /api/judge` lance le juge sur les leads sans jugement, pour les classes de la configuration. Il dépense des tokens et lit la clé `JEV_API_KEY` comme la CLI ; sans elle, la réponse est `400`.
- Un seul travail à la fois : pendant qu'il tourne, `POST /api/scan` et `POST /api/judge` répondent `409`.
- L'usage d'un travail lancé par l'API porte l'identifiant du lancement du service, comme celui de la CLI.

### Lire le contrat

Ouvrir `http://127.0.0.1:7331/openapi` pour la documentation, ou récupérer `http://127.0.0.1:7331/openapi/json`. C'est la référence des routes, de leurs paramètres et de leurs réponses.

### Brancher un front

- **Servi par l'API** : `--public <dossier>` sert le dossier à `/`. Une page sans extension qui n'existe pas (par exemple `/leads/12`) renvoie son `index.html`. Les chemins `/api` et `/openapi` sont réservés. Le front appelle l'API en chemins relatifs, par exemple `fetch("/api/leads")`.
- **Hébergé ailleurs** : `--cors <origine>` (répétable, ou séparées par des virgules) autorise son origine, et le front appelle l'URL complète. Sans l'option, un autre site ne peut pas lire l'API.
- Sans `--public`, la page factice `srcs/api/public/index.html` est servie : elle affiche `/api/meta` et `/api/summary` et explique ces deux branchements.

### Tester

```bash
bun run test
```

Lancer `bun test` sans `--isolate` fait échouer les tests de la base avec un message qui le dit : ils refusent de toucher à la vraie `.paragone/`.

## La suite

J'aimerais mettre en place plusieurs choses :

- Améliorer le traitement des inventaires afin que, ceux qui le permettent, puissent être teintés également. Cela permettrait de bien suivre par exemple ce qu'il y a dans le stockage local du navigateur, qui peut parfois amener à des dingueries en BB.
- Comme évoqué plus haut, avoir un générateur pour domlogger++. Ce n'est pas un travail simple. Mais pas infaisable non plus.
- Donner la possibilité de servir un fichier modifié afin de détecter pendant la navigation des leads exécutés.
- Mettre en place la version anglaise. Elle existe en partie, mais je trouvais que la façon de l'amener était mal foutue. Ce n'est pas très compliqué ceci dit.
- Filer un "dossier" à un LLM.
- Ajouter une commande "skill.md"
- Améliorer l'aspect sécuritaire du programme, protection des données et cie. Pour l'instant c'est inexistant.
- Factoriser le code, notamment une fonction de la partie teinte, dans [`set_identifier_value`](https://github.com/kibatche/paragone/blob/fa63f74e74fa5a5118104825e09bea4b17cdff40/srcs/analyze/taint/set_identifier_value.ts#L1349). C'est une fonction très complexe, et même en la relisant, j'ai du mal à comprendre ce que j'ai écrit : ce n'est jamais bon signe. Cette partie là est de base compliquée, mais je pense qu'il y a moyen de la séparer en plusieurs parties plutôt qu'un gros blob comme ça.
- Et le gros dossier : pouvoir faire ce qu'on fait avec l'api, pour la récupération de données, avec la CLI. Cela permettrait à une machine d'aller directement requêter la BDD, sans passer par HTTP et sans devoir parser la base de données sqlite.
- Ecrire un article plus détaillé sur le code et son fonctionnement
- Mieux attribuer les auteurs
- Mieux commenter mon code.

## LLM & cie

On est obligé de parler de cela. `paragone` est un projet personnel. Si une partie non négligeable a été faite avec un LLM (l'api par exemple), l'ensemble de ce travail est le mien. Les LLM sont là pour obéir à nos demandes, pas pour créer des choses de toutes pièces qui donnent, bien souvent, de la daube.

J'ai pour plaisir la programmation, mais je ne me plais pas à tout programmer, voilà tout. C'est un projet conséquent, donc les trucs que je n'aime pas, je les refile en général. Ce n'est pas tout le temps vrai cependant. En fait, il n'y a jamais de règles qui tiennent totalement.

Dans tous les cas, ne serait-ce que pour garder ses compétences, c'est important de les exercer. Une grande partie de ce projet avec un LLM a consisté à lui demander de tester l'application, de trouver les failles de détection etc. et mettre à jour ma roadmap perso.

Tout n'est pas parfait, loin de là, mais cette façon de fonctionner est plutôt cool.

Est-ce que ça veut dire que ce programme est un bon programme et qu'il n'est pas bugué ? Non. J'ai fait de mon mieux pour explorer un champ de la sécurité informatique. Si vous n'aimez pas mon travail, écrivez le votre !

Ou mieux, ouvrez une issue. :-)

## Comment participer

Pas d'issues ouvertes par des LLM, elles seront toutes jetées. L'idée est que des humains, y compris aidés par des LLM, puissent comprendre et soumettre pour la base de code.

Les parties analyses ne sont pas pour ainsi dire toutes évidentes. La partie teinte est quant à elle parfois excessivement difficile. Du gloubi-boulga de code pondu par un LLM n'est pas souhaitable.

Je verrai pour installer des règles si besoin est (tsc, eslint, prettier...), mais le plus probable est que ce repo reste aux tréfonds d'internet !!

Il y a très certainement des tonnes de bugs, n'hésitez pas à les remonter si vous le souhaitez.

## Sécurité

Ce programme est le niveau 0 de la sécurité informatique. N'exposez **jamais** l'api sur une IP du type `0.0.0.0`. L'api permet de faire tout ce qu'on veut avec les données. Je n'ai pas encore pentesté mon application, mais il n'est pas impossible non plus qu'on puisse faire du path traversal et cie.

## Licence

Pas de licence.

Faite ce que vous voulez de cela, mais n'hésitez pas à créditer si, par le plus grand des hasards, vous utgilisez ce travail. C'est toujours sympa  !

