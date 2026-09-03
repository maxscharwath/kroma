# Trailers

Status: **AGREED**

A trailer is promotional video attached to a movie. It is not a title, not an
edition, and not one of the movie's media files. A person watches it to decide
whether to start the movie.

This chapter is movies only. A show trailer is not specified here.

What the bytes technically are is [`media.md`](../media/README.md). How they play
is [`playback.md`](../playback/README.md). This file owns which trailer exists,
in which language, and when the bytes are kept.

## Catalog

Status: **AGREED**

**LIB-1** (AGREED) - A matched movie may carry a trailer catalog from its
metadata provider: one or more promotional clips, each with a spoken language
and a kind (trailer or teaser).

**LIB-2** (AGREED) - The catalog is stored with the title. A later browse does
not need the provider online to know that a trailer exists.

**LIB-3** (AGREED) - A library that was matched before trailers existed still
gains catalogs without a full metadata refresh of every title. Asking for one
movie's trailer fills that movie if its catalog is still missing.

## Language

Status: **AGREED**

The spoken language of the clip follows the person watching, not the household
catalog language and not the movie's original language.

**LIB-4** (AGREED) - KROMA picks one clip from the catalog, in this order: a
trailer in the viewer's UI language, then an English trailer, then any official
trailer, then any trailer, then a teaser under the same language order.

**LIB-5** (AGREED) - An official clip of a given kind and language outranks an
unofficial one of the same kind and language.

**LIB-6** (AGREED) - When the catalog has no clip at all, the movie has no
trailer. The product does not invent one.

## Bytes

Status: **AGREED**

The player only ever opens files this server hosts. A remote promotional host is
not a playback source.

**LIB-7** (AGREED) - Trailer bytes are fetched only when someone plays that
trailer. Opening a movie, browsing the library, and enrichment do not download
clips. The first play starts as soon as a playable prefix exists and KROMA
keeps the finished copy for later plays.

**LIB-8** (AGREED) - The copy is in a form every first-class surface can
direct-play. A format a television cannot decode is converted once, when the
copy is made, never at each play.

**LIB-9** (AGREED) - Offline, a trailer that already has a local copy still
plays. A trailer that has no copy yet is absent, the same as a title that has
never been enriched.

**LIB-10** (AGREED) - An operator may turn trailers off for the whole server.
While they are off, no catalog is fetched, no copy is made, and no movie offers
a trailer.

## Not in scope

- Playing the trailer, resume, and watch history are
  [`playback.md`](../playback/README.md).
- Whether a surface shows the Trailer action is
  [`surfaces.md`](../surfaces/README.md).
- Show trailers, extras already sitting in the movie folder, and a muted loop
  behind the detail hero are not specified here.
