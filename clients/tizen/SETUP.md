# Deploying KROMA to a real Samsung TV

The [`Makefile`](./Makefile) automates **build → sign → install → launch**. The
one-time setup below is the part that can't be scripted (it needs the Tizen
tools, your Samsung account, and your TV). Do it once, then `make deploy` is all
you need.

```
make doctor                       # check tools + config
make deploy TV_IP=192.168.1.50    # build, sign, install, launch on the TV
make logs                         # watch the app's console output
```

## Fast path one command for the toolchain

```bash
bash clients/tizen/scripts/bootstrap-macos.sh
```

Installs Rosetta, downloads + opens the Tizen Studio installer, and verifies the
toolchain. You still do the click-through install and the three Samsung-bound
steps below (Developer Mode, the certificate, your TV's IP) nothing can
automate those.

---

## 1. Enable Developer Mode on the TV (1 min)

1. Open **Apps** (Smart Hub).
2. Press `1 2 3 4 5` on the remote → the **Developer Mode** dialog appears.
3. Turn **Developer mode ON**, and for **Host PC IP** enter **this computer's
   IP** (macOS: System Settings → Network).
4. Reboot the TV.

Find the TV's IP under **Settings → General/Network → Network Status → IP
settings** (or your router). You'll pass it as `TV_IP`.

## 2. Install the Tizen CLI

You need the `tizen` and `sdb` commands. Easiest is **Tizen Studio** (you'll need
it once anyway for the certificate in step 3):

1. Download **Tizen Studio (with IDE)** for macOS from
   <https://developer.tizen.org/development/tizen-studio/download>.
   - Apple Silicon: it runs under Rosetta; Java 17+ is required (you have 21).
2. In **Tizen Studio → Package Manager**, install:
   - **Extension SDK → Samsung Certificate Extension**
   - **Extension SDK → TV Extensions** (TV-x.x)
3. Default install path is `~/tizen-studio`. The Makefile auto-detects
   `~/tizen-studio/tools/ide/bin/tizen` and `~/tizen-studio/tools/sdb`. If you
   put it elsewhere, set `TIZEN_HOME` in `.tizen.env`.

> CLI-only alternative: Samsung also ships a CLI-only package, but the Samsung
> **certificate** in step 3 is created through Certificate Manager (GUI), so
> Tizen Studio is the path of least resistance.

## 3. Create a Samsung certificate (retail TVs require this)

Retail Samsung TVs only run apps signed with a **Samsung** author + distributor
certificate, and the distributor cert is tied to your TV's **DUID**. Create it
once:

1. Connect to the TV first so its DUID can be read:
   ```
   make connect TV_IP=<your-tv-ip>
   make devices            # confirm the TV shows up
   ```
2. Open **Tizen Studio → Tools → Certificate Manager → + (new)**.
3. Choose **Samsung**, type **TV**, and follow the wizard:
   - Sign in with your **Samsung account**.
   - Create/ös pick an **Author** certificate.
   - For the **Distributor** certificate, the wizard reads the **DUID of the
     connected TV** make sure the TV is connected (step 1) and select it.
4. Name the **profile** `KROMA` (or set `PROFILE` in `.tizen.env` to whatever you
   name it). This profile is what `make package` signs with.

> A self-signed Tizen cert (`make cert-selfsigned`) only works on the **emulator**,
> not a retail TV that's why the Samsung wizard is required here.

## 4. Configure + deploy

```bash
cp .tizen.env.example .tizen.env     # then edit TV_IP + PROFILE
make doctor                          # everything green?
make deploy                          # build → sign → install → launch 🎉
```

After it's installed, iterate fast with `make redeploy` (re-uses the connection)
and watch logs with `make logs`.

### Live dev on the TV (hot reload)

For UI/player work, skip the repackage loop entirely: install a one-time **dev
shell** that redirects the TV to the Vite dev server on your machine, so it loads
the live app and hot-reloads on every save.

```bash
cd clients/tizen && make dev-shell TV_IP=192.168.1.50   # install the shell once
bun run dev:tizen:device                                # run from the repo root
```

`make dev-shell` builds a normal signed `.wgt` but swaps its `index.html` for a
tiny loader that redirects to `http://<this-machine>:5174/`, then installs it
(under the shipped app's id it replaces the shipped app while you develop).
`dev:tizen:device` serves the app over the LAN with the letterbox frame off and
`console.*` kept. Edit code → it reloads on the TV. The KROMA server must be running
and reachable (`bun run server:watch`); the dev shell seeds its API address to this
machine automatically. Re-run `make dev-shell` only if your LAN IP changes; run
`make deploy` to restore the real app.

> Why a redirect and not a hosted app? Retail firmware rejects a wgt whose content
> is a remote URL (and gives no error you can read dlog/shell are locked down), so
> we ship a valid local build that navigates to the dev server on launch.
>
> After the redirect the page origin is the dev server, so `webapis`/`tizen.*`
> device calls (LAN discovery, preview, deep links) may be unavailable while in the
> dev shell. The player and catalog UI don't need them; use `make deploy` to test
> those integration paths.

## 5. Point the app at your media server

On first launch the app shows a connection screen enter
`http://<server-ip>:4040`. It persists in `localStorage`, so subsequent launches
go straight to the library. Make sure the server is running and reachable from
the TV's network (`bun run server` on the host, or the Docker image on your NAS).

---

## Supported TVs: the Tizen 6.0 floor

KROMA requires **Tizen 6.0 (2021 models) or newer**. `config.xml` sets
`required_version="6.0"`, and a retail set refuses a widget that demands a
platform newer than its own with an opaque `install failed[118]`. That was the
whole of [#86](https://github.com/maxscharwath/kroma/issues/86).

The floor is deliberate, not a bug. A 2017/Tizen-3.0 set ships **Chromium M47**
(4.0 is M56, 5.0 is M63), far older than the web build assumes, and lowering
`required_version` alone does not make the app run there. See
[`tv.target.ts`](./tv.target.ts) and [`STORE.md`](./STORE.md) for the
Chromium-per-Tizen table and the legacy build tier that makes 6.0 honest.

How far below the floor M47 sits, measured on the built bundle rather than
guessed. `esbuild --target=chrome47 dist/legacy/index.js` fails with thousands of
constructs it cannot lower, dominated by `let` and destructuring, then default
arguments and `class`; the same command at `chrome53` succeeds. The bundle runs
sloppy, so those need M49, not the M41/M42 they would need under `use strict`.

Both are reachable with tools this build does not currently run, so the floor is
a cost decision rather than an impossibility. Babel lowers the same bundle to
chrome47 clean (`preset-env` plus an explicit class transform, since the bundle
is sloppy), for about 11% more bytes, and the API gap is roughly fifty core-js
polyfills plus real shims for ResizeObserver, IntersectionObserver and
AbortController, which core-js does not cover.

The stylesheet needs a different tool rather than a harder one. Lightning CSS
leaves `var()` alone at every target because it does not resolve custom
properties; postcss-custom-properties does, and pinning a theme clears most of
the file. What it leaves behind is a short list of element-scoped properties that
are still defined in the sheet. The price is that theming stops going through the
cascade and becomes one flattened stylesheet per theme, swapped at runtime.

So a 2017 set is a third build tier, not a one-line manifest edit, and the part
none of this settles is playback: the bundle drives MSE and HLS, and whether a
2017 set direct-plays what KROMA serves can only be answered on the hardware.

Do not try to settle this on the TV simulator. `sec-tv-simulator` is a webapis
shim over one bundled NW.js, so `--tizentvversion 3.0` changes the API surface
and nothing else: launched that way it still reports `Chrome/137` over CDP, still
supports `let`, `var()`, `@layer` and optional chaining, and advertises a
user-agent claiming `Chrome/55` that matches neither its real engine nor a 2017
set's M47. It answers "works" for a build no such TV can parse. Only a retail set
below the floor, or the static checks above, tell the truth.

So the fix for a below-floor set is not to lower the number: it is to fail
legibly. `make doctor` / `make preflight` read the connected set's platform
version and, if it is under the floor, print
`✗ this TV is Tizen X.Y; KROMA requires >= 6.0, this set is not supported` and
stop before `tizen install` runs.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `sdb` can't connect | Dev Mode off, wrong Host PC IP, or firewall. Re-do step 1 and reboot the TV. Port is `26101`. |
| Install fails with an opaque code (`install failed[118]` / *Failed to install*) | Run `make doctor` (or `make preflight`) with the TV connected. The most common cause is a set **older than the Tizen floor** (see below): `make doctor` reads the set's platform version and says so plainly instead of letting `tizen install` fail blindly. |
| Install fails: *signature / certificate* | The profile isn't a **Samsung** cert, or the cert's DUID doesn't match this TV. `make doctor` flags a non-Samsung profile and a stale differently-signed install where the firmware lets it; recreate the cert (step 3) with the TV connected, and `make uninstall` first if the app was installed under a different author. |
| App installs but won't launch | Try `make run` again, or `sdb -s <serial> shell 0 was_execute KromaTV001.KROMA`. Check `make logs`. |
| `tizen: command not found` | Set `TIZEN_HOME` in `.tizen.env`, or add `~/tizen-studio/tools/ide/bin` and `~/tizen-studio/tools` to `PATH`. |
| Black screen / no data | The app can't reach the server. Re-enter `http://<server-ip>:4040` and confirm the TV and server share a network. |
