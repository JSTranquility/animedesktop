# Validation record

Prepared locally on CachyOS, GNOME Shell 51.1, GJS, GTK 4.24 and libadwaita 1.10. See [GitHub Actions](https://github.com/JSTranquility/animedesktop/actions) for remote CI status; this document records the local checks.

## Portable checks

`npm test` covers JavaScript/shell syntax, 252 calendar grids and date boundaries, theme bounds, preference validation and immutable edits, and Python tests for installation/rollback, font ownership, opt-in integration, asset validation and publication auditing. It inspects staged Git blobs to catch private state even if a working-tree copy differs.

## GJS and graphical checks

- `gjs -m tests/project-root.js`: installed checkout discovery, paths containing spaces and explicit overrides.
- `gjs -m tests/preferences-store.js`: atomic writes, image paths, a pre-edit backup, merging external changes, invalid-file preservation and explicit recovery from the example configuration.
- `GIO_USE_VFS=local dbus-run-session -- gjs -m tests/mpris-fixture.js`: discovery, metadata and capability changes, all three playback commands, player exit and no-player safety.
- `python3 tests/nested.py --preferences`: isolated GNOME 51 with the actual GTK preferences window. Text, switches, slider, color, image acceptance and installed-app selection persist; the desktop reloads after changes. The native file dialog is constructed and its image-acceptance path tested, but clicking through the operating system's file chooser is not automated.
- `python3 tests/nested.py --dual`: isolated 1920×1080 and 1280×1024 displays, one desktop composition, native allocations, calendar controls, launcher fixture, fallback states, two atomic saves and clean shutdown. Exit status 0.

Screenshots under `docs/images/` were captured from the isolated compositor using only the original demo SVGs. They do not contain the personal desktop or downloaded character art.

The isolated environment reports missing portal/IBus/accessibility services, which are retained in ignored local logs. Those messages are not passed off as successful accessibility or portal testing. Physical HDMI hotplug, GPU FPS measurements and interactive file-chooser navigation remain manual checks.

## Publication

No personal configuration, dconf backups, session logs, home-directory literals, downloaded character images or known credential signatures appear in the reviewed Git index. The source archive is generated from that index. Its extraction and portable checks are tested in a new temporary directory containing spaces. This does not constitute an exhaustive secret scan or a claim that remote CI has run.

Preferences maximization: a virtual pointer inside the isolated compositor performs real titlebar double-clicks. The first maximizes, the second restores the prior width and height (`AG_TEST_DOUBLE_CLICK`). The test leaves buttons and page selectors to their native handlers.

## Prepublication gate — 2026-11-09

- Portable checks repeated successfully, including the reviewed alternate-hash handling for the optional asset CDN.
- Actual install, initial configuration, autostart generation, runtime checkout discovery and full rollback executed successfully from the source archive in an isolated HOME/D-Bus session using a temporary keyfile settings backend. The personal desktop was not modified.
- Native preferences, real double-click maximize/restore and desktop reload repeated successfully in an isolated GNOME compositor (exit 0).
- Optional Chisa downloads verified against the approved hashes; the changed CDN image variant was visually inspected before adding its explicit alternative hash. Unknown changes still fail verification.
- Public Git contents were reviewed again; downloaded artwork, local configuration, logs and backups remain excluded.
