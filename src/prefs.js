import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { resolveProjectRoot } from './services/project-root.js';
import { PreferencesController } from './preferences/window.js';

export default class AnimeDesktopPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window._animeDesktopPreferences = new PreferencesController(
            window,
            resolveProjectRoot(import.meta.url),
        );
    }
}
