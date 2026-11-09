import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk?version=4.0';
import { PreferencesController } from '../src/preferences/window.js';
const root = GLib.getenv('ANIME_GLASS_HOME');
const ready = GLib.getenv('ANIMEDESKTOP_PREFS_READY');
if (!root || !ready) throw new Error('Run through tests/nested.py --preferences');
const app = new Adw.Application({
    application_id: 'io.github.jsttranquility.AnimeDesktop.PreferencesTest',
    flags: Gio.ApplicationFlags.NON_UNIQUE,
});
let passed = false;
app.connect('activate', () => {
    const window = new Adw.PreferencesWindow({ application: app });
    const controller = new PreferencesController(window, root);
    window.present();
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
        try {
            if (window.modal || !window.resizable)
                throw new Error('Preferences must be modeless and resizable');
            if (!controller.store || controller.controls.size < 20)
                throw new Error('Preferences controls missing');
            if (!(controller.imageDialog('gallery.0') instanceof Gtk.FileDialog))
                throw new Error('Native image picker could not be constructed');
            controller.controls.get('name').text = 'Demo';
            controller.controls.get('panelOpacity').set_value(80);
            controller.controls.get('animations').active = false;
            const color = new Gdk.RGBA();
            color.parse('#BE5068');
            controller.controls.get('theme.accent').rgba = color;
            controller.acceptImage(
                'gallery.0',
                Gio.File.new_for_path(root + '/assets/demo/card-2.svg'),
            );
            let rejected = false;
            try {
                controller.acceptImage(
                    'gallery.1',
                    Gio.File.new_for_path(root + '/config/settings.json'),
                );
            } catch (_) {
                rejected = true;
            }
            if (!rejected) throw new Error('Non-image accepted');
            const apps = controller._apps('dockApps', 'Dock');
            function find(widget, type) {
                if (widget instanceof type) return widget;
                for (
                    let child = widget.get_first_child();
                    child;
                    child = child.get_next_sibling()
                ) {
                    const result = find(child, type);
                    if (result) return result;
                }
                return null;
            }
            const list = find(apps.content, Gtk.ListBox);
            const first = list?.get_row_at_index(0);
            const check = first ? find(first, Gtk.CheckButton) : null;
            if (!check) throw new Error('Installed applications list is empty');
            check.active = !check.active;
            apps.close();
            controller.store.flush();
            const config = controller.store.read();
            if (
                config.name !== 'Demo' ||
                config.panelOpacity !== 0.8 ||
                config.animations !== false ||
                config.theme.accent !== '#BE5068' ||
                !config.gallery[0].endsWith('card-2.svg')
            )
                throw new Error('GTK control changes did not persist');
            Gio.File.new_for_path(ready).replace_contents(
                'ready',
                null,
                false,
                Gio.FileCreateFlags.NONE,
                null,
            );
            passed = true;
            print('AG_PREFS_PASS images, colors, switches, slider, text and persistence');
        } catch (error) {
            logError(error);
            app.quit();
        }
        return GLib.SOURCE_REMOVE;
    });
    GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 7, () => {
        window.close();
        app.quit();
        return GLib.SOURCE_REMOVE;
    });
});
app.run([]);
if (!passed) throw new Error('Preferences smoke test failed');
