import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { edit } from './model.js';

export class PreferencesStore {
    constructor(root, onSaved = () => {}, onError = () => {}) {
        this.root = root;
        this.file = Gio.File.new_for_path(root + '/config/settings.json');
        this.onSaved = onSaved;
        this.onError = onError;
        this.timer = 0;
        this.dirty = new Map();
        this.backedUp = false;
        if (!this.file.query_exists(null))
            Gio.File.new_for_path(root + '/config/settings.example.json').copy(
                this.file,
                Gio.FileCopyFlags.NONE,
                null,
                null,
            );
        this.config = this.read();
    }
    read() {
        const [, bytes] = this.file.load_contents(null);
        const config = JSON.parse(new TextDecoder().decode(bytes));
        if (!config || typeof config !== 'object' || Array.isArray(config))
            throw new Error('La configuración debe ser un objeto JSON');
        return config;
    }
    set(path, value) {
        this.config = edit(this.config, path, value);
        this.dirty.set(path, value);
        if (this.timer) GLib.source_remove(this.timer);
        this.timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
            this.timer = 0;
            try {
                this.flush();
            } catch (error) {
                this.onError(error);
            }
            return GLib.SOURCE_REMOVE;
        });
    }
    flush() {
        if (this.timer) {
            GLib.source_remove(this.timer);
            this.timer = 0;
        }
        if (!this.dirty.size) return;
        // Merge only changed controls into the latest file; preserve external edits.
        let latest = this.read();
        for (const [key, value] of this.dirty) latest = edit(latest, key, value);
        if (!this.backedUp) {
            const stamp =
                GLib.DateTime.new_now_local().format('%Y%m%d-%H%M%S') + '-' + GLib.get_real_time();
            const backup = Gio.File.new_for_path(this.root + '/backups/preferences-' + stamp);
            backup.make_directory_with_parents(null);
            this.file.copy(backup.get_child('settings.json'), Gio.FileCopyFlags.NONE, null, null);
            this.backedUp = true;
        }
        this.file.replace_contents(
            JSON.stringify(latest, null, 2) + '\n',
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null,
        );
        this.config = latest;
        this.dirty.clear();
        this.onSaved();
    }
    close() {
        if (this.timer) {
            GLib.source_remove(this.timer);
            this.timer = 0;
        }
        try {
            this.flush();
        } catch (error) {
            this.onError(error);
        }
    }
}

export function restoreDefaults(root) {
    const example = Gio.File.new_for_path(root + '/config/settings.example.json');
    const [, bytes] = example.load_contents(null);
    const config = JSON.parse(new TextDecoder().decode(bytes));
    if (!config || typeof config !== 'object' || Array.isArray(config))
        throw new Error('La configuración de ejemplo no es válida');
    const target = Gio.File.new_for_path(root + '/config/settings.json');
    if (target.query_exists(null)) {
        const backup = Gio.File.new_for_path(
            root + '/backups/preferences-recovery-' + GLib.get_real_time(),
        );
        backup.make_directory_with_parents(null);
        target.copy(backup.get_child('settings.json'), Gio.FileCopyFlags.NONE, null, null);
    }
    target.replace_contents(
        JSON.stringify(config, null, 2) + '\n',
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
    );
}
