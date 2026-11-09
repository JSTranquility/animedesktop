#!/usr/bin/gjs -m
import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { PreferencesController } from '../src/preferences/window.js';
const root =
    GLib.getenv('ANIMEDESKTOP_HOME') ||
    Gio.File.new_for_uri(import.meta.url)
        .get_parent()
        .get_parent()
        .get_path();
const app = new Adw.Application({
    application_id: 'io.github.jsttranquility.AnimeDesktop.Preferences',
    flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
});
app.connect('activate', () => {
    const window = new Adw.PreferencesWindow({ application: app });
    window._controller = new PreferencesController(window, root);
    window.present();
});
app.run([]);
