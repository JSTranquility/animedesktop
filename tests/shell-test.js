import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';
export async function run() {
    await Scripting.sleep(2500);
    Main.overview.hide();
    await Scripting.sleep(1500);
    const e = Main.extensionManager.lookup('anime-glass@jsttranquility');
    console.log('AG_TEST_EXTENSION ' + JSON.stringify({ state: e?.state, error: e?.error }));
    if (e?.state !== 1) throw new Error('Extension did not activate');
    const obj = e.stateObj;
    if (GLib.getenv('ANIME_GLASS_TEST_PENDING')) {
        const pending = Gio.File.new_for_path(
            GLib.getenv('ANIME_GLASS_HOME') + '/config/pending-settings.json',
        );
        if (pending.query_exists(null) || obj._config().theme?.mode !== 'dark')
            throw new Error('Pending dark theme did not activate');
        console.log('AG_TEST_PENDING theme applied and consumed at startup');
    }
    const [sx, sy] = obj._root.get_scale();
    if (sx !== 1 || sy !== 1) throw new Error('Root still magnifies rasterized widgets');
    if (obj._root.width < 1800) throw new Error('Full HD root was not laid out at native size');
    console.log('AG_TEST_NATIVE full-size layout with identity transform');
    for (const a of obj._root.get_children())
        console.log(
            'AG_STYLE ' +
                a.constructor.name +
                ' ' +
                a.style_class +
                ' ' +
                a.get_theme_node().get_background_color().to_string() +
                ' ' +
                a.width +
                'x' +
                a.height,
        );
    const buttons = [];
    const visit = (a) => {
        if (a.accessible_name) buttons.push(a);
        for (const ch of a.get_children()) visit(ch);
    };
    visit(obj._root);
    for (const name of ['Next month', 'Previous month', 'Return to current month']) {
        const b = buttons.find((b) => b.accessible_name === name);
        if (!b) throw new Error('Missing calendar control ' + name);
        b.emit('clicked', 1);
    }
    console.log('AG_TEST_CALENDAR controls clicked');
    const marker = GLib.getenv('ANIME_GLASS_LAUNCH_MARKER');
    if (marker) {
        const app = Shell.AppSystem.get_default().lookup_app('anime-glass-test.desktop');
        if (!app) throw new Error('Fixture desktop app undiscovered');
        const b = obj._appButton(app, 24, {});
        obj._root.add_child(b);
        b.emit('clicked', 1);
        await Scripting.sleep(1000);
        if (!GLib.file_test(marker, GLib.FileTest.EXISTS)) throw new Error('App launch failed');
        b.destroy();
        console.log('AG_TEST_LAUNCH real desktop app activated');
    }

    obj._build();
    obj._build();
    console.log('AG_TEST_REBUILD twice');
    const invalidPath = GLib.getenv('ANIME_GLASS_INVALID_CONFIG');
    if (invalidPath) {
        const saved = obj._configFile;
        obj._configFile = Gio.File.new_for_path(invalidPath);
        obj._build();
        if (!obj._root) throw new Error('Invalid config fallback failed');
        obj._configFile = saved;
        obj._build();
        console.log('AG_TEST_CONFIG invalid JSON fallback');
    }

    if (obj._asset('assets/missing.png') !== '') throw new Error('Missing resource not handled');
    const original = obj._config.bind(obj);
    obj._config = () => ({
        ...original(),
        monitor: 99,
        dockApps: ['nonexistent.desktop'],
        sideApps: [],
        gallery: ['absent.png'],
        character: 'absent.png',
        performanceMode: true,
    });
    obj._build();
    if (!obj._root) throw new Error('Fallback build failed');
    obj._config = original;
    obj._build();
    console.log('AG_TEST_FALLBACK missing image/app/monitor and performance mode');
    await Scripting.sleep(1500);

    const file = Gio.File.new_for_path(
        GLib.getenv('ANIME_GLASS_TEST_OUTPUT') || GLib.get_tmp_dir() + '/animedesktop-test.png',
    );
    const stream = file.replace(null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    const shot = new Shell.Screenshot();
    await shot.screenshot(false, stream);
    stream.close(null);
    console.log('AG_TEST_SCREENSHOT saved');
    if (GLib.getenv('ANIMEDESKTOP_TEST_PREFS')) {
        const launcher = new Gio.SubprocessLauncher({ flags: Gio.SubprocessFlags.NONE });
        launcher.setenv('WAYLAND_DISPLAY', 'anime-glass-test', true);
        launcher.setenv('GIO_USE_VFS', 'local', true);
        const script = Gio.File.new_for_uri(import.meta.url)
            .get_parent()
            .get_child('preferences-smoke.js')
            .get_path();
        const process = launcher.spawnv(['gjs', '-m', script]);
        const ready = Gio.File.new_for_path(GLib.getenv('ANIMEDESKTOP_PREFS_READY'));
        const previous = obj._root;
        for (let i = 0; i < 16 && !ready.query_exists(null); i++) await Scripting.sleep(400);
        if (!ready.query_exists(null)) throw new Error('Preferences window failed to initialize');
        await Scripting.sleep(800);
        if (obj._root === previous)
            throw new Error('Desktop did not reload after preferences edits');
        const output = Gio.File.new_for_path(GLib.getenv('ANIMEDESKTOP_PREFS_OUTPUT')).replace(
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null,
        );
        await new Shell.Screenshot().screenshot(false, output);
        output.close(null);
        const preferences = global
            .get_window_actors()
            .map((actor) => actor.meta_window)
            .find((window) => window.get_title() === 'AnimeDesktop');
        if (!preferences?.can_maximize()) throw new Error('Preferences window cannot maximize');
        const pointer = global.stage
            .get_context()
            .get_backend()
            .get_default_seat()
            .create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
        // A newly created virtual pointer starts at the hot corner; leave overview first.
        pointer.notify_absolute_motion(GLib.get_monotonic_time(), 1000, 600);
        await Scripting.sleep(150);
        Main.overview.hide();
        preferences.activate(global.get_current_time());
        await Scripting.sleep(400);
        const doubleClickTitlebar = async () => {
            const rect = preferences.get_frame_rect();
            pointer.notify_absolute_motion(GLib.get_monotonic_time(), rect.x + 100, rect.y + 24);
            await Scripting.sleep(80);
            Main.overview.hide();
            for (let click = 0; click < 2; click++) {
                pointer.notify_button(
                    GLib.get_monotonic_time(),
                    Clutter.BUTTON_PRIMARY,
                    Clutter.ButtonState.PRESSED,
                );
                await Scripting.sleep(30);
                pointer.notify_button(
                    GLib.get_monotonic_time(),
                    Clutter.BUTTON_PRIMARY,
                    Clutter.ButtonState.RELEASED,
                );
                await Scripting.sleep(80);
            }
            await Scripting.sleep(500);
        };
        const originalRect = preferences.get_frame_rect();
        await doubleClickTitlebar();
        if (!preferences.get_maximize_flags())
            throw new Error('Titlebar double-click did not maximize');
        const expandedFile = Gio.File.new_for_path(
            GLib.getenv('ANIMEDESKTOP_PREFS_OUTPUT').replace('.png', '-maximized.png'),
        );
        const expandedStream = expandedFile.replace(
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null,
        );
        await new Shell.Screenshot().screenshot(false, expandedStream);
        expandedStream.close(null);
        await doubleClickTitlebar();
        if (preferences.get_maximize_flags())
            throw new Error('Second titlebar double-click did not restore');
        const restoredRect = preferences.get_frame_rect();
        if (
            Math.abs(restoredRect.width - originalRect.width) > 2 ||
            Math.abs(restoredRect.height - originalRect.height) > 2
        )
            throw new Error('Restored window did not keep its prior size');
        console.log(
            'AG_TEST_DOUBLE_CLICK native titlebar maximize/restore and original size verified',
        );
        await new Promise((resolve, reject) =>
            process.wait_check_async(null, (p, result) => {
                try {
                    p.wait_check_finish(result);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            }),
        );
        console.log('AG_TEST_PREFERENCES GTK controls, persistence and desktop reload verified');
    }

    if (GLib.getenv('ANIME_GLASS_HOME')) {
        const file = obj._configFile;
        const [, data] = file.load_contents(null);
        const saved = new TextDecoder().decode(data);
        const changed = JSON.parse(saved);
        changed.performanceMode = true;
        let previous = obj._root;
        try {
            file.replace_contents(
                JSON.stringify(changed),
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null,
            );
            await Scripting.sleep(1100);
            if (obj._root === previous) throw new Error('Atomic config reload not received');
            previous = obj._root;
            file.replace_contents(
                saved,
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null,
            );
            await Scripting.sleep(1100);
            if (obj._root === previous) throw new Error('Second atomic config reload not received');
            console.log('AG_TEST_CONFIG_WATCH two atomic saves rebuilt UI');
        } finally {
            file.replace_contents(
                saved,
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null,
            );
        }
    }

    obj.disable();
    await Scripting.sleep(500);
    obj.enable();
    await Scripting.sleep(500);
    console.log('AG_TEST_LIFECYCLE disable/enable; shutdown cleanup armed');
}
