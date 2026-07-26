# Weather images

Drop files here and they appear automatically — no code change.

## Filenames (exact)

The scene picks the file from the condition and the time of day:

    /public/weather/<condition>-<day|night>.webp

| condition | covers (WMO codes)                    |
|-----------|---------------------------------------|
| `bright`  | clear, mainly clear, partly cloudy    |
| `grey`    | overcast, fog                         |
| `wet`     | drizzle, rain, showers                |
| `storm`   | thunderstorm, thunderstorm with hail  |
| `cold`    | snow, snow grains, snow showers       |

Ten files in total, e.g. `wet-night.webp`. Any that are missing simply fall
back to the drawn scene — you can add them one at a time.

## Specs

- **Aspect**: 9:19.5 portrait, 1170×2532 or larger. It is rendered `cover`,
  anchored at `center 30%`, so the top third is what survives cropping.
- **Format**: `.webp`, quality ~72. **Keep each file under 180KB.** This app
  is built for patchy Indian mobile data and ships an offline mode; ten heavy
  photos would undo that.
- **Composition**: the top two-thirds carry the sky. The centre is where the
  mood word sits in large white type — keep it uncluttered and mid-to-dark so
  the text stays legible. The bottom fades out under a scrim anyway.
- **No text, no logos, no faces, no recognisable landmarks.**

A scrim is applied over every image, so images can be a little brighter than
feels right in isolation.
