import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { resolveProjectRoot } from '../src/services/project-root.js';
const root = GLib.dir_make_tmp('animedesktop-path-XXXXXX');
const directory = Gio.File.new_for_path(root);
const install = directory.get_child('installed extension');
install.make_directory(null);
const manifest = install.get_child('project-location.json');
const oldNew = GLib.getenv('ANIMEDESKTOP_HOME'),
    oldLegacy = GLib.getenv('ANIME_GLASS_HOME');
try {
    GLib.unsetenv('ANIMEDESKTOP_HOME');
    GLib.unsetenv('ANIME_GLASS_HOME');
    manifest.replace_contents(
        JSON.stringify({ root: root + '/checkout with spaces' }),
        null,
        false,
        Gio.FileCreateFlags.NONE,
        null,
    );
    const uri = install.get_child('extension.js').get_uri();
    if (resolveProjectRoot(uri) !== root + '/checkout with spaces')
        throw new Error('Installed checkout path was not resolved');
    GLib.setenv('ANIMEDESKTOP_HOME', root + '/override', true);
    if (resolveProjectRoot(uri) !== root + '/override') throw new Error('Override not respected');
    print('PASS: portable installed path, spaces and explicit override');
} finally {
    if (oldNew !== null) GLib.setenv('ANIMEDESKTOP_HOME', oldNew, true);
    else GLib.unsetenv('ANIMEDESKTOP_HOME');
    if (oldLegacy !== null) GLib.setenv('ANIME_GLASS_HOME', oldLegacy, true);
    else GLib.unsetenv('ANIME_GLASS_HOME');
    manifest.delete(null);
    install.delete(null);
    directory.delete(null);
}
