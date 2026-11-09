import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { PreferencesStore, restoreDefaults } from '../src/preferences/store.js';
function check(value, message) {
    if (!value) throw new Error(message);
}
function remove(file) {
    if (
        file.query_file_type(Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null) ===
        Gio.FileType.DIRECTORY
    ) {
        const e = file.enumerate_children(
            'standard::name',
            Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
            null,
        );
        let info;
        while ((info = e.next_file(null))) remove(file.get_child(info.get_name()));
        e.close(null);
    }
    file.delete(null);
}
const root = GLib.dir_make_tmp('animedesktop-prefs-store-XXXXXX');
const dir = Gio.File.new_for_path(root);
dir.get_child('config').make_directory(null);
const example = dir.get_child('config/settings.example.json');
example.replace_contents(
    JSON.stringify({ name: 'Original', gallery: ['a', 'b', 'c', 'd'], theme: { mode: 'dark' } }),
    null,
    false,
    Gio.FileCreateFlags.NONE,
    null,
);
let store;
try {
    store = new PreferencesStore(root);
    store.set('name', 'Updated');
    store.set('gallery.1', '/tmp/user picture.png');
    store.flush();
    let config = store.read();
    check(
        config.name === 'Updated' && config.gallery[1] === '/tmp/user picture.png',
        'Settings did not persist',
    );
    store.set('badgeTitle', 'Mine');
    config.externalMarker = 42;
    config.name = 'External';
    store.file.replace_contents(
        JSON.stringify(config),
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
    );
    store.flush();
    config = store.read();
    check(
        config.externalMarker === 42 && config.name === 'External' && config.badgeTitle === 'Mine',
        'External edits were overwritten',
    );
    store.file.replace_contents(
        '{broken',
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
    );
    store.set('name', 'Pending');
    let failed = false;
    try {
        store.flush();
    } catch (_) {
        failed = true;
    }
    check(failed, 'Invalid external JSON was overwritten');
    const [, bytes] = store.file.load_contents(null);
    check(new TextDecoder().decode(bytes) === '{broken', 'Corrupt original was changed');
    store.file.replace_contents(
        JSON.stringify(config),
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
    );
    store.flush();
    check(store.read().name === 'Pending', 'Pending change was lost');
    const backups = dir
        .get_child('backups')
        .enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
    let count = 0;
    while (backups.next_file(null)) count++;
    backups.close(null);
    check(count === 1, 'Expected one pre-edit backup');
    store.file.replace_contents(
        '{broken again',
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
    );
    restoreDefaults(root);
    check(store.read().name === 'Original', 'Native recovery did not restore defaults');
    print(
        'PASS: preferences atomic persistence, image path, one backup, external-edit merge and invalid-file protection',
    );
} finally {
    store?.close();
    remove(dir);
}
