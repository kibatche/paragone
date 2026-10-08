## Intro

`paragone` analyse des fichiers JavaScript/TypeScript, en extrait des morceaux potentiellement vulnérables de code, et analyse ces derniers afin de découvrir la source d'un identifiant et estimer sa contrôlabilité.

L'idée est d'analyser des bundles minifiés, qui font parfois plusieurs centaines de milliers de lignes. `paragone` parse leur AST, détecte les formes vulnérables qu'il est capable de détecter, les note selon un score de contrôlabilité, et enregistre le tout en base de données.

Exemple, un sink :

```js
t.innerHtml = '<div>' + r + </div>
```

Une fois l'analyse terminée, la source :

```js
const r = document.getElementById('name').value
```

C'est un exemple simple. `paragone` peut fonctionner sur des formes plus complexes. `paragone` est pratique sur des bases de code larges, minifiées.

Le programme est expliqué plus en détails ici : `## Qu'est-ce que c'est ?`.

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

Ce projet utilise une IA de type `System One`.

Pour ce projet précis, commencé bien avant l'arrivée de telles IA, ce paradigme est parfait.

Plutôt que de générer du texte, ce type d'IA donne une probabilité, avec un score de confiance, qu'une assertion soit plus probable qu'une autre, selon trois modalités différentes (`noul`, `choice`, `score`).

En l'occurrence, ce projet a été testé avec `jev`, développé par TypeSafe.

Plus d'infos [ici](https://docs.typesafe.ai/introduction).

Une clé est donc nécessaire, si vous souhaitez juger les leads automatiquement. Cependant, cela n'est pas obligatoire, même si le principe reste tout de même d'avoir des leads.

Dans un fichier `.env`, à la racine du projet :

```bash
JEV_API_KEY=…
```

Normalement, toute IA compatible avec le client de TypeSafe - comme `Clef` - devrait fonctionner, mais cela n'a pas été testé.

## Aide (`--help`)

```bash
Usage: paragone [options]

Projet :
  -p, --project-path <dir>    Dossier du projet (défaut : dossier courant)
  -n, --project-name <name>   Nom du projet (défaut : nom du dossier)

Analyse :
  -a, --analyze <path>        Dossier ou fichier à scanner
  -c, --classes <classes...>  Classes de vulnérabilité à envoyer au juge, parmi : CSPT, XSS, CODE_EXEC, OPEN_REDIRECT, WEB_MESSAGE, ALL. Insensible à la casse, répétable ou séparée par des virgules (défaut : toutes)
  --no-scan                   Saute le scan automatique du dossier

Jugement :
  -j, --judge                 Lance le juge pour ce run. Ne supprime aucune donnée pré-existante
  -b, --batch <n>             Nombre de dossier(s) à envoyer au juge, strictement entre 0 et 10 (défaut : 1)

Serveur (host, port, cors et public n'ont d'effet qu'avec --serve) :
  -s, --serve                 Lance l'API. Utilisable seul
  -H, --host <ip>             Adresse d'écoute de l'API (défaut : 127.0.0.1)
  -P, --port <n>              Port d'écoute de l'API (défaut : 7331)
  --cors <origins...>         Origine(s) autorisée(s) à appeler l'API depuis un autre site. Répétable ou séparée par des virgules
  --public <dir>              Dossier du frontend servi à la racine de l'API

Général :
  -r, --reset                 ATTENTION, destructif : détruit la base de données et force un scan du corpus
  --noninteractive            Mode non-interactif : --reset et --project-path s'utilisent sans TTY et sans confirmation

Options:
  -h, --help                  display help for command
```

## Démarrage rapide

1. Installation
```bash
bun install && bun link
```

2. Allez dans un dossier de travail, par exemple `BugBounty/MegaCorp`.

`paragone` fonctionne avec du JavaScript beautifié, pas un oneliner de plusieurs milliers d'octets qui lévera une erreur. Prenez `jxscout` pour récupérer vos données.

3. Optionnel - Clonez le repo `paragone-front`

```bash
git clone git@github.com:kibatche/paragone-front.git
```

Cela vous permettra d'avoir un front qui n'existe pas dans ce projet de base.

4. Lancez `paragone` sur votre dossier :

```bash
paragone --analyze ~/jxscout/megacorp/original/auth.megacorp.com/ --judge --serve --classes all --project megacorpAnalysis --public ~/monfront/public
```

Cela lancera une analyse automatique sur tous les fichiers JavaScript du dossier. En ressortiront des leads, sous forme de dossiers, qui seront envoyés à `jev`.

Vous pouvez maintenant accéder aux données soit via la base de données directement, soit via l'API (méthode conseillée pour les yeux).

Si vous ne souhaitez pas lancer de scan automatisé, indiquez l'option `--no-scan`.

Un premier lancement configure le fichier `.paragone/paragone_config.json`, avec les valeurs spécifiées dans les options, ou celles par défaut si certaines ne sont pas spécifiées.

La configuration prend en compte les données dans cet ordre :

Configuration par défaut < Configuration `.paragone/paragone_config.json` < Options de la cli.

### Vous n'avez pas de clé `jev` mais vous souhaitez voir à quoi ça ressemble

Vous pouvez lancer une analyse sans juge.

Vous pouvez aussi voir des images du rendu dans ce repo : [`paragone-front`](https://github.com/kibatche/paragone-front)

## Qu'est-ce que c'est ?

`paragone` est un programme qui s'insère dans la phase de recon : il repère des formes syntaxiques dangereuses, l'utilisation de fonctions qu'on sait conduire à des vulnérabilités, inventorie les utilisations de fonctions tel que le localStorage, les cookies etc. Il permet de faire de nombreuses choses, que vous pouvez retrouver dans le code dans le dossier `srcs/analyze/ast_analyzers`.

### Remplacer les expressions régulières de la recon par l'analyse de l'AST

On peut voir `paragone` comme une tentative de remplacement à l'analyse par expression régulière lors des phases de recon sur une cible : en seulement quelques secondes, les fichiers sont parsés et analysés, envoyés à `jev` et jugés. Le tout passe par l'AST des fichiers, un moyen puissant d'explorer le code de façon programmatique. Même sur plusieurs dizaines de fichiers et plusieurs centaines voir millions de lignes de code, le programme reste très rapide : moins d'une minute sur ma machine.

Autre intérêt : parser l'AST permet de récupérer les identifiants, et les teinter, c'est à dire remonter l'arbre qui conduit à son placement dans un sink, trouver sa source si possible, et jauger sa contrôlabilité et donc sa dangerosité.

### Un centre de triage des données

On peut voir aussi ce programme comme étant un centre de triage des leads. En effet, des centaines de leads peuvent être écrits et jugés, ce qui rend le tout assez conséquent à traiter. 

Le programme propose donc une API OpenAPI qui permet de faire ce que fait la CLI, mais avec la possibilité de placer un jugement humain en plus. Ce n'est pas grand chose, et les jugements de `jev` peuvent suffire.

Pour l'instant, il n'est pas possible de faire ce jugement via la CLI : il faudrait proposer une sorte de front pour le terminal, et cela ne se ferait qualitativement qu'avec un TUI, ce qui représente un travail conséquent.

Plus d'infos dans la section `## La suite`.

### LLM friendly

Le travail avec les LLM est maintenant incontournable. C'est peu de dire qu'il s'agit d'une évolution majeure dans nos vies, qu'on aime cela ou non, dès lors qu'on travaille dans l'informatique.

Si ce programme est avant tout pour les humains, il s'efforce de le rendre pratique pour des LLM également, afin qu'ils puissent avoir le même niveau d'information.

Cet aspect est voué à être amélioré, en réfléchissant à l'implémentation d'une API-CLI : faire ce qu'on peut faire avec l'API, mais en CLI, sans HTTP. Plus d'infos dans `## La suite`.

## Qu'est-ce que ça n'est pas ?

C'est un programme d'analyse *statique*. [Théorème de Rice sur l'indécidabilité de l'arrêt](https://fr.wikipedia.org/wiki/Th%C3%A9or%C3%A8me_de_Rice).

`paragone` ne pourra pratiquement jamais garantir à 100% quelque chose : il ne donne que des indices sur ce qu'il est intéressant d'aller creuser, à partir du code client. Tout est fait pour que ces indices soient les plus utiles possibles, notamment grâce au paradigme décisionnel utilisé par les IA de type System One.

Cependant, les vrais tests se font à l'exécution. L'analyse statique permet de brosser rapidement certaines choses, l'analyse dynamique de les confirmer et d'en découvrir d'autres.

Ce programme ne permet pas non plus de "hacker". C'est une aide à la récupération d'informations. Ce n'est jamais qu'une seule petite brique très spécialisée au sein d'un _workflow_ de recon.

En bref, comme on dit : il ne fait pas le café !

## Les analyseurs : impacts, inventaires, et détecteur.

Ils sont de plusieurs sortes : les analyseurs avec impact (CSPT, XSS etc.), les analyseurs d'inventaire (`localStorage`, `secrets` etc) et les sources. Un dernier est un détecteur de désinfection simple (DOMPurify...).

Les sources n'offrent pas d'analyse en tant que telle, elles permettent juste de signifier lors d'une teinte que l'identifiant a une source nommée et connue. Idem pour la détection de la désinfection. Cela aide votre jugement, et le scoring de `jev`.

Une bonne partie des analyseurs vient de `jxscout`, même s'ils ont été réécrits entièrement pour la majeure partie. L'honnêteté oblige à le dire, il a vraiment fait un taff de fou pour lequel je dois beaucoup.

## API avec [Elysia](https://elysiajs.com/patterns/openapi)

`--serve` lance une API HTTP qui sert les données de `.paragone/findings.db` du dossier courant ou du projet choisi : leads, jugements, fichiers scannés, usage du juge.

L'api permet de faire ce qu'on peut faire avec la CLI, mais via HTTP.

### Lancer

Depuis le dossier qui contient `.paragone/` :

```bash
paragone --serve
paragone -a ./example.com --serve --port 8000
paragone --serve --public /votre/vue/public --cors http://localhost:5173
```

Le troisième exemple sert la page factice du dépôt ; remplacer `/votre/vue/public` par le dossier du front.

Aucun front n'est fourni dans ce repo. Vous pouvez trouver un front d'exemple là : https://github.com/kibatche/paragone-front

### Définitions OpenApi

Une fois l'API servie, vous pouvez accéder à `http://IP:PORT/openapi`. Les définitions de toutes les routes seront présentes. Vous pouvez également accéder `/openapi/json` pour la version JSON.

### Configurer et lancer un scan ou un juge

La configuration se fait de la même façon qu'une utilisation avec la CLI, au lancement. La route `/api/config` permet de changer le configuration. Veuillez vous référer aux définitions OpenAPI pour plus détails.

### Brancher un front

- **Servi par l'API** : `--public <dossier>` sert le dossier à `/`. Une page sans extension qui n'existe pas renvoie son `index.html`.
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
- Améliorer les analyseurs, en rajouter d'autres.
- Faire en sorte de systématiser l'ajout d'une analyse : au lieu de programmer un analyseur, juste définir ce qu'on souhaite analyser. Je ne sais pas si c'est possible, c'est juste une idée.
- Avoir une configuration stable : pour l'instant c'est une configuration au sein de la mémoire. Je crois que cela est un peu bancal, même si ça fonctionne.
- Une teinte inter-module ? Très difficile.
- Tester et mettre en place la possibilité d'avoir n'importe quel provider d'une IA `System One`.

## LLM & cie

On est obligé de parler de cela. `paragone` est un projet personnel. Si une partie non négligeable a été faite avec un LLM (l'api par exemple), l'ensemble de ce travail reste celui d'un humain. Mon assistant digital à notifier grâce à `@author (...) Shevek` ce qu'il a écrit.

Cela améliore la traçabilité, même si le système n'est pas parfait. En effet, vu les nombreuses réécritures et une tendance mal assumée du "fais ce que je dis, pas ce que je fais", cette traçabilité n'est pas parfaite et tenue à jour.

## Comment participer

Si vous souhaitez améliorer le programme, n'hésitez pas à le faire. Je regarderai vos propositions.

N'hésitez pas à remonter les bugs, proposer d'autres analyseurs, améliorer ceux existants, améliorer la teinte, ou tout simplement forker le programme et faire le votre !

## Sécurité

Ce programme est le niveau 0 de la sécurité informatique. N'exposez **jamais** l'API sur une IP du type `0.0.0.0`, sauf si vous savez ce que vous faîtes. L'api permet de faire tout ce qu'on veut avec les données. Soyez vigilant.es.

## Merci

Gloire à Francisco Neves pour son énorme travail sur `jxscout`, que j'utilise toujours dans sa version pas-pro, sans cela je n'aurais jamais pu explorer de façon aussi approfondie les AST JavaScript.

Et un grand merci à ma chatte Ursula !

## Licence

[`MIT`](https://choosealicense.com/licenses/mit/).

Faite ce que vous voulez de cela, mais n'hésitez pas à créditer si, par le plus grand des hasards, vous utilisez ce travail. C'est toujours sympa !

