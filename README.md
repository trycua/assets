# Cua assets

Static media used by the [Cua documentation](https://cua.ai/docs).

The [X video audit](VIDEO_AUDIT.md) inventories the public video posts from
`@trycua` and `@francedot`, with post context, highest-resolution X CDN links,
and a true midpoint frame for every video. Regenerate it with:

```sh
node scripts/audit-x-videos.mjs
```

GitHub Pages publishes the contents of `public/` at:

```text
https://trycua.github.io/assets/
```

## Cua Driver videos

| Asset | Original post |
| --- | --- |
| `macos-background-chrome.mp4` | [@trycua](https://x.com/trycua/status/2047383209244287350) |
| `macos-trajectory-capture.mp4` | [@trycua](https://x.com/trycua/status/2047383207612645426) |
| `windows-msbuild-piano.mp4` | [@francedot](https://x.com/francedot/status/2062231318294131130) |
| `windows-wpf-agent-qa.mp4` | [@trycua](https://x.com/trycua/status/2059688966085853245) |
| `windows-legacy-postal-app.mp4` | [@trycua](https://x.com/trycua/status/2059693301276565841) |
| `linux-calculator-agent-qa.mp4` | [@trycua](https://x.com/trycua/status/2067639342944985586) |
| `linux-headless-spreadsheet.mp4` | [@trycua](https://x.com/trycua/status/2067639346719826213) |
| `linux-multi-pointers.mp4` | [@trycua](https://x.com/trycua/status/2067639340738761015) |
| `linux-wayland-16-cursors.mp4` | [@trycua](https://x.com/trycua/status/2067639344698179789) |

Video URLs follow this pattern:

```text
https://trycua.github.io/assets/videos/cua-driver/<filename>.mp4
```

Matching poster images live under `posters/cua-driver/`.
