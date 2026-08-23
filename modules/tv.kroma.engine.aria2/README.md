# aria2 engine

aria2 JSON-RPC as a download sub-engine for the Downloads module.

A backend-only capability module: no page, no routes. Its `ServerModule`
(in this module's own `server/` crate, `kroma-aria2`) registers a
`download-client` factory of kind `aria2` on enable and unregisters it on
disable, so toggling it adds or removes aria2 from the download-client
picker. `dependsOn` the Downloads module (`tv.kroma.torrents`), which owns
the registry.

Layout: `server/` (backend crate) + `module.json` (manifest). See
`modules/README.md` for the guide.
