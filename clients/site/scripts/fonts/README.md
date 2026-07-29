# Static font instances, for the social card only

`HankenGrotesk-400.ttf` and `HankenGrotesk-600.ttf` are **generated**, not new brand
assets. They are static instances of the kit's own variable font,
`packages/ui/src/assets/fonts/HankenGrotesk.ttf` (`wght` 100–900), and exist for
one reason: Satori's font parser crashes on a variable font's `fvar` table, so the
card generator (`../og.tsx`) cannot read the variable file directly.

Bricolage Grotesque is **not** here — its file already ships static, so the
generator reads it straight out of `@kroma/ui`.

Nothing at runtime uses these: the site loads its webfonts the normal way, and the
card is a PNG committed under `public/`. They are build inputs for `bun run og`.

To regenerate them (after a font update in the kit), with
[fontTools](https://github.com/fonttools/fonttools) installed:

```bash
python3 - <<'PY'
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

src = 'packages/ui/src/assets/fonts/HankenGrotesk.ttf'
for weight in (400, 600):
    font = TTFont(src)
    instantiateVariableFont(font, {'wght': weight}, inplace=True, updateFontNames=True)
    font.save(f'clients/site/scripts/fonts/HankenGrotesk-{weight}.ttf')
PY
```

Then `bun run --filter '@kroma/site' og` to redraw the cards.
