# RFC: movie trailers in the KROMA player

- Status: **DRAFT**
- PR: pending
- Affects: `docs/spec/library/trailers.md`, `docs/spec/playback/README.md`,
  `docs/spec/surfaces/README.md`, areas `area/server` `area/tv` `area/web`

## Summary

A movie detail screen offers Trailer. The clip plays in the same player as the
movie, in the viewer's UI language, falling back to English then to any official
trailer. The server keeps a local copy on first play and streams that copy. No
client ever opens YouTube.

## Motivation

A person standing on a movie they have not seen has no way to sample it short of
starting the feature. Every competing media server offers a trailer on that
screen. KROMA already has a player, a metadata provider, and a local-file
delivery path. What it does not have is a trailer that those three can share.

The hard constraint is the player. Desktop mpv is launched with YouTube
extraction off, on purpose: KROMA only opens its own HTTP file URLs. An iframe
or a YouTube URL handed to the engine would work on the web tab and nowhere
else, which is how you ship a feature that televisions cannot use.

## Proposal

### What the person sees

On movie detail, next to Play, a Trailer button when a catalog entry exists.
Hidden otherwise. Shows, discover titles without a library item, and a muted
loop behind the hero are out.

Tapping it opens the existing player on that movie, labelled as a trailer,
starting at zero. When it ends, the player offers this movie. Watch progress,
continue-watching, and watched are untouched.

### Catalog

Enrichment fetches the provider's video list for a movie once, all languages,
and stores it with the title. Each clip is a YouTube key, a spoken language, a
kind (Trailer or Teaser), and whether it is official. Non-YouTube hosts are
dropped.

A library matched before this change does not need a full re-enrich. Catalogs
are filled in the background from the video list alone. The first trailer
request for a movie still fetches and stores the catalog if it is missing.

### Language

One clip is chosen at request time, not at enrich time, so two accounts on the
same server can hear different languages.

Order: trailer in the viewer's UI language, then an English trailer, then any
official trailer, then any trailer, then a teaser under the same language
order. Official outranks unofficial inside a rung.

### Bytes

Bytes move only when someone hits play, never when they open a fiche or when
enrichment runs. On first play `yt-dlp` fetches AND merges the clip, preferring
H.264 up to 1080p plus AAC; ffmpeg is used only to re-encode a source whose best
rendition is a codec a television cannot decode. yt-dlp does the fetching
because a googlevideo URL refuses a whole-file Range and throttles a single
sequential connection: anything that pulls the bytes itself gets a 403 or about
1.4x realtime. The copy lands at `<data>/trailers/{key}.part.mp4` and is renamed
to `{key}.mp4`, moov first, when it is complete.

The player asks for `/api/items/:id/trailer/stream?key=`, never for the movie's
`/stream` and never for YouTube. Prepare (`POST /api/items/:id/trailer/prepare`)
picks the clip, starts the copy, and answers as soon as the source reports the
clip's length, which is well before the first byte: the player therefore always
knows its duration. It answers `preparing` with a percentage until the file is
whole, and the client shows that rather than opening on nothing. The stream
route serves the finished file with Range and starts no work of its own, so it
stays safe to leave unauthenticated. Concurrent plays of one key share the copy.

If `yt-dlp` is missing or the download fails, the movie has no trailer. The
button is not shown, or it fails with one sentence and does not start the movie.

An operator toggle, default on, cuts catalog fetch, caching, and the action for
the whole server. Same idea as theme songs, defaulted the other way because
this is an explicit action people will look for.

### What stays out of the player

No YouTube URL, no iframe, no `ytdl` in mpv. Theme songs already cache a remote
file and serve it locally. This is that, for video.

## What this costs

`yt-dlp` is a new server binary, documented next to `curl` and `ffmpeg`. YouTube
changes the extractor often. A release will sometimes need a `yt-dlp` bump
before trailers work again. That is a maintenance promise we do not currently
have.

YouTube's terms do not love this. Jellyfin and others do it anyway, on the
operator's machine, for a clip the studio already posted as a trailer. It is
the operator's network and their risk. We do not run a trailer CDN.

Disk: tens of megabytes per movie that someone actually trails, not per title
in the library. Opening movie detail does not start a download. The tap only
waits on picking a clip (a local catalog, or one TMDB JSON fetch on an old
library). Picture starts on the first playable fragment; a slow first play is
buffering, not a frozen button.

The cached file is H.264+AAC MP4 so every surface direct-plays it. That is a
one-time encode for VP9/AV1 sources, not a playback transcode.

## Compatibility

Existing libraries keep working. Older clients that never learned the Trailer
button simply never show it. Paired devices and installed modules are
untouched. Theme songs, mpv's `--ytdl=no`, and the movie `/stream` path do not
change.

A client that does not send `Accept-Language` and has no account language gets
English, then any official trailer.

## Alternatives

**Do nothing.** Movie detail stays Play, list, watched, report. People who want
a trailer leave the app.

**YouTube iframe, web only.** Televisions, mpv, and VLC cannot use it. The
product would have two players.

**Local `-trailer.mkv` extras only.** Most libraries do not have those files.
"Trailer of each movie" would be empty for almost everyone.

**Download every trailer at enrich.** A thousand-movie library would fetch a
thousand YouTube clips on scan, most of them never watched. First play is
lazier and honest about the cost.

**A trailers module.** Closer to the "core is playback and catalog" line, but
then the baseline feature is missing until someone installs a module. Theme
songs already live in core. Trailers follow that.

## Unresolved

Show trailers, if anyone wants them, reuse this path. Local extras as a
preferred source over YouTube. Casting a trailer to another device. A muted
hero loop.
