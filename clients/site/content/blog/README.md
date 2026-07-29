# Écrire un article

Le blog est un **dossier de fichiers `.mdx`**. Pour publier, il suffit d'en
déposer un ici. Rien d'autre à toucher : pas de route à créer, pas d'index à
mettre à jour, pas de configuration.

```bash
# 1. Créez le fichier — son nom EST l'URL (le « slug »).
#    content/blog/mon-article.mdx  ->  https://kroma.tv/blog/mon-article
touch content/blog/mon-article.mdx
```

Au prochain `bun run build`, l'article est :

- **découvert** automatiquement (un glob lit le dossier) ;
- **prérendu** en HTML statique (le crawler suit le lien depuis `/blog`) ;
- daté, trié (plus récent d'abord) et son **temps de lecture calculé** tout seul.

## Le frontmatter

Chaque fichier commence par un bloc YAML entre `---`. Un seul champ est
réellement requis (`title`), mais remplissez-les : ils alimentent la liste, la
page de l'article et l'aperçu social (Open Graph).

```mdx
---
title: "Le titre de l'article"          # requis
date: "2026-01-14"                        # AAAA-MM-JJ — sert au tri et à l'affichage
excerpt: "Une phrase de résumé, montrée dans la liste et la carte sociale."
author: "Votre nom"                       # défaut : « L'équipe KROMA »
tags: ["Annonce", "Coulisses"]           # optionnel
cover: "/blog/mon-article/cover.jpg"     # optionnel, image de la carte sociale
draft: false                              # true = visible en dev, masqué au build
---

Votre contenu commence ici. C'est du **Markdown** — plus tout le MDX si besoin.
```

## Ce que vous pouvez écrire

Du Markdown standard, plus les extras déjà câblés :

- **GFM** : tableaux, listes de tâches, texte barré (`remark-gfm`).
- **Titres ancrés** : chaque `##` reçoit un `id` (`rehype-slug`) — liens profonds gratuits.
- **Blocs de code colorés** : Shiki met en forme les ``` ```ts ``` etc. dans le thème charbon.
- **Composants React** : importez et utilisez des composants dans le `.mdx` si un
  article a besoin de quelque chose d'interactif (c'est tout l'intérêt du MDX).

La mise en forme de l'article (typographie, liens ambre, code, citations) vient
de la classe `.prose-kroma` — vous n'avez rien à styliser, écrivez juste le fond.

## Prévisualiser

```bash
bun run --filter '@kroma/site' dev      # http://localhost:3100/blog
```

En développement, les brouillons (`draft: true`) sont visibles ; le build de
production les masque. Voilà — écrire un article, c'est écrire un fichier.
