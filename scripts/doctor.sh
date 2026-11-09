#!/usr/bin/env bash
set -euo pipefail
missing=0
for executable in gnome-shell gnome-extensions gjs python3 gsettings fc-cache; do
 if command -v "$executable" >/dev/null; then printf 'OK %s\n' "$executable"; else printf 'MISSING %s\n' "$executable"; missing=1; fi
done
if command -v gnome-shell >/dev/null; then
 shell_version="$(gnome-shell --version)"
 printf '%s\n' "$shell_version"
 if [[ ! "$shell_version" =~ 51\. ]]; then printf 'Only GNOME 51 is currently declared compatible.\n'; missing=1; fi
fi
if command -v gjs >/dev/null; then
 gjs -c "imports.gi.versions.Soup = '3.0'; imports.gi.versions.Gtk = '4.0'; imports.gi.versions.Adw = '1'; void imports.gi.Soup; void imports.gi.Gtk.FileDialog; void imports.gi.Adw.PreferencesWindow;" || missing=1
fi
printf 'Session: %s\n' "${XDG_SESSION_TYPE:-unknown}"
exit "$missing"
