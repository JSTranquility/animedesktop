import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export function resolveProjectRoot(moduleUrl) {
    const override = GLib.getenv('ANIMEDESKTOP_HOME') || GLib.getenv('ANIME_GLASS_HOME');
    if (override) return override;
    const source = Gio.File.new_for_uri(moduleUrl).get_parent();
    try {
        const [, bytes] = source.get_child('project-location.json').load_contents(null);
        const data = JSON.parse(new TextDecoder().decode(bytes));
        if (typeof data.root === 'string' && GLib.path_is_absolute(data.root)) return data.root;
    } catch (_) {
        /* Direct source execution uses the checkout parent. */
    }
    return source.get_parent().get_path();
}
