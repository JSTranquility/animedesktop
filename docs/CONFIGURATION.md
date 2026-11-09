# Configuration

Most settings are available in the native preferences window: `./scripts/preferences.sh` or the installed extension’s profile badge. Image choices use the system file picker and absolute local paths; they remain in ignored local configuration.

`config/settings.json` is local and untracked. Installation copies `settings.example.json` only if local settings do not exist. `chisa.example.json` is an optional third-party-art profile.

| Key | Meaning |
|---|---|
| `wallpaper`, `character`, `gallery` | Absolute paths or paths relative to the checkout; four gallery slots |
| `applyWallpaper` | Set false to keep the GNOME wallpaper |
| `galleryOpacity` | Gallery intensity, clamped to 0.4–1 |
| `name`, `greeting` | Optional name or custom greeting |
| `characterTitle`, `badgeTitle` | Decorative character heading and profile badge |
| `locale` | Calendar/date locale such as `es` or `en` |
| `clockFormat` | GLib format such as `%H:%M`; seconds enable per-second updates outside performance mode |
| `dockApps`, `sideApps` | Up to five installed `.desktop` IDs per group; unknown apps are omitted |
| `monitor` | `primary` or integer index; absent monitor falls back to primary |
| `panelScale` | Composition scale, clamped to 0.65–1 |
| `panelOpacity` | Glass tint opacity, clamped to 0.08–0.94 |
| `animations`, `performanceMode` | Motion/performance controls; GNOME reduced-motion preference is respected |
| `theme.mode` | `dark` for dark defaults |
| `theme.foreground`, `muted`, `accent`, `surface`, `raised`, `border` | Six-digit hex colors |
| `theme.blurRadius`, `blurBrightness` | Radius 0–40; background brightness 0–1 |
| `theme.animationDuration` | 0–250 ms, disabled by reduced motion/performance mode |

Geometry and theme tokens live in `src/themes/tokens.js`. Preserve native allocations; do not magnify the root actor to resize text.

## Optional integrations

```json
{
  "integration": {
    "disableExtensions": ["gridgets@rebatnaath.github.com", "dash-to-dock@micxgx.gmail.com"],
    "stopHidamari": true
  }
}
```

These actions run once per login only after AnimeDesktop is ACTIVE. Defaults are an empty list and false. They do not uninstall other software or modify Hidamari's own autostart files. The session helper has a bounded wait and an instance lock.

## File layout

- `src/`: extension and modular widgets/services.
- `config/*.example.json`: shareable configuration examples.
- `assets/demo/`: original MIT SVG assets.
- `assets/fonts/`: Orbitron plus OFL license.
- `assets/chisa-sources.json`: URLs, credits and SHA-256, without artwork.
- `assets/{wallpapers,characters,gallery}/`: downloaded/local art, ignored by Git.
- `backups/`, `logs/`, `dist/`: local/generated state, ignored by Git.

The installer writes `project-location.json` only into the installed extension directory. That generated file points to this checkout and must never be committed. Keep the checkout at its installation path. `ANIMEDESKTOP_HOME` is an optional runtime override; `ANIME_GLASS_HOME` remains supported for test/legacy compatibility.
