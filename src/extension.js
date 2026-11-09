import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { label, button, image, place } from './components/ui.js';
import { createClock } from './widgets/clock.js';
import { createCalendar } from './widgets/calendar.js';
import { createMusic } from './widgets/music.js';
import { nativeSizeTree } from './components/native-size.js';
import { layout, theme, rgba } from './themes/tokens.js';
import { resolveProjectRoot } from './services/project-root.js';
const BASE = resolveProjectRoot(import.meta.url);
export default class AnimeGlass extends Extension {
    enable() {
        this._applyPendingConfiguration();
        this._signals = [];
        this._sources = [];
        this._missing = new Set();
        this._signals.push([global, global.connect('shutdown', () => this.disable())]);
        this._configFile = Gio.File.new_for_path(BASE + '/config/settings.json');
        this._monitor = this._configFile.monitor_file(Gio.FileMonitorFlags.NONE, null);
        this._monitor.connect('changed', () => {
            if (this._reload) GLib.source_remove(this._reload);
            this._reload = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 400, () => {
                this._reload = 0;
                this._build();
                return GLib.SOURCE_REMOVE;
            });
        });
        this._signals.push([
            Main.layoutManager,
            Main.layoutManager.connect('monitors-changed', () => this._build()),
        ]);
        this._build();
    }
    _applyPendingConfiguration() {
        const pending = Gio.File.new_for_path(BASE + '/config/pending-settings.json');
        if (!pending.query_exists(null)) return;
        try {
            const [, data] = pending.load_contents(null);
            const text = new TextDecoder().decode(data);
            const config = JSON.parse(text);
            if (
                !config ||
                typeof config !== 'object' ||
                Array.isArray(config) ||
                !Array.isArray(config.gallery)
            )
                throw new Error('Invalid pending configuration');
            Gio.File.new_for_path(BASE + '/config/settings.json').replace_contents(
                text,
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null,
            );
            pending.delete(null);
        } catch (e) {
            console.error('Anime Glass pending theme:', e);
        }
    }
    _config() {
        try {
            const [, b] = this._configFile.load_contents(null);
            const c = JSON.parse(new TextDecoder().decode(b));
            c.panelOpacity = Math.max(0.08, Math.min(0.94, Number(c.panelOpacity) || 0.24));
            for (const k of ['dockApps', 'sideApps', 'gallery'])
                if (!Array.isArray(c[k])) c[k] = [];
            c.dockApps = c.dockApps.filter((x) => typeof x === 'string').slice(0, 5);
            c.sideApps = c.sideApps.filter((x) => typeof x === 'string').slice(0, 5);
            return c;
        } catch (e) {
            console.error('Anime Glass config:', e);
            return {
                panelOpacity: 0.24,
                dockApps: [],
                sideApps: [],
                gallery: [],
                performanceMode: true,
                theme: { mode: 'dark' },
            };
        }
    }
    _asset(path) {
        if (typeof path !== 'string' || !path) return '';
        const p = path.startsWith('/') ? path : BASE + '/' + path;
        if (GLib.file_test(p, GLib.FileTest.IS_REGULAR)) return p;
        if (!this._missing.has(p)) {
            this._missing.add(p);
            console.warn('Anime Glass missing resource: ' + p);
        }
        return '';
    }
    _clear() {
        this._root?.destroy();
        this._root = null;
    }
    _build() {
        this._clear();
        const c = this._config();
        if (
            !new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' }).get_boolean(
                'enable-animations',
            )
        )
            c.animations = false;
        const t = theme(c);
        let m = Main.layoutManager.primaryMonitor;
        if (Number.isInteger(c.monitor)) m = Main.layoutManager.monitors[c.monitor] || m;
        if (!m) return;
        const scale =
            Math.min(m.width / layout.width, m.height / layout.height) *
            Math.max(0.65, Math.min(1, Number(c.panelScale) || 1));
        const root = new St.Widget({
            width: Math.round(1200 * scale),
            height: Math.round(675 * scale),
            reactive: false,
        });
        root.style = `font-size:${14 * scale}px;color:${t.foreground};`;
        this._root = root;
        root.connect('destroy', () => {
            if (this._root === root) this._root = null;
        });
        root.set_position(m.x + (m.width - 1200 * scale) / 2, m.y + (m.height - 675 * scale) / 2);
        Main.layoutManager._backgroundGroup.add_child(root);
        const glass = place(
            root,
            new St.Widget({
                style_class: 'ag-glass',
                style: `background-color:${t.dark ? rgba(t.surface, c.panelOpacity) : `rgba(210,232,248,${c.panelOpacity})`};`,
            }),
            178,
            76,
            960,
            460,
        );
        // Native Shell background sampling, confined to this actor; never a screen-wide effect.
        if (!c.performanceMode) {
            try {
                glass.add_effect(
                    new Shell.BlurEffect({
                        mode: Shell.BlurMode.BACKGROUND,
                        radius: t.blurRadius,
                        brightness: t.blurBrightness,
                    }),
                );
            } catch (e) {
                console.warn('Anime Glass blur unavailable:', e.message);
            }
        }
        const wallpaper = this._asset(c.wallpaper);
        if (wallpaper && c.applyWallpaper !== false) {
            const settings = new Gio.Settings({ schema_id: 'org.gnome.desktop.background' });
            const uri = Gio.File.new_for_path(wallpaper).get_uri();
            for (const key of ['picture-uri', 'picture-uri-dark'])
                if (settings.get_string(key) !== uri) settings.set_string(key, uri);
        }
        place(root, this._widget(createClock, c, 'Reloj'), 234, 112, 205, 100);
        place(root, this._widget(createCalendar, c, 'Calendario'), 220, 224, 185, 235);
        place(
            root,
            new St.Widget({
                style_class: 'ag-glass',
                style: `border-radius:44px;background-color:${rgba(t.surface, 0.82)};`,
            }),
            54,
            76,
            80,
            460,
        );
        const side = place(
            root,
            new St.BoxLayout({
                orientation: Clutter.Orientation.VERTICAL,
                style_class: 'ag-glass',
                style: 'padding:18px 9px;spacing:22px;border-radius:44px;background-color:transparent;border:0;box-shadow:none;',
            }),
            54,
            76,
            80,
            460,
        );
        side.add_child(button('system-search-symbolic', () => Main.overview.show()));
        for (const id of c.sideApps) {
            const app = Shell.AppSystem.get_default().lookup_app(id);
            if (app) side.add_child(this._appButton(app, 31, c));
        }
        const char = this._asset(c.character);
        if (char) place(root, image(char, 380, 526, 0), 477, 48, 380, 526);
        const hour = new Date().getHours();
        const greeting =
            typeof c.greeting === 'string'
                ? c.greeting.slice(0, 40)
                : c.locale?.startsWith('en')
                  ? hour < 5
                      ? 'Good evening'
                      : hour < 12
                        ? 'Good morning'
                        : hour < 19
                          ? 'Good afternoon'
                          : 'Good evening'
                  : hour < 5
                    ? 'Buenas noches'
                    : hour < 12
                      ? 'Buenos días'
                      : hour < 19
                        ? 'Buenas tardes'
                        : 'Buenas noches';
        place(
            root,
            label(
                c.name ? `${greeting}, ${String(c.name).slice(0, 24)}` : greeting,
                `font-size:21px;font-weight:700;color:${t.foreground};`,
            ),
            875,
            188,
            240,
            35,
        );
        place(
            root,
            label(
                String(c.characterTitle || '山 田 リ ョ ウ').slice(0, 35),
                `font-size:12px;letter-spacing:3px;color:${t.accent};`,
            ),
            875,
            146,
            230,
            24,
        );
        for (let i = 0; i < 4; i++) {
            const p = this._asset(c.gallery[i]);
            if (p) {
                const card = new St.Button({
                    reactive: true,
                    track_hover: true,
                    style_class: 'ag-button',
                    style: `transition-duration:${t.animationDuration}ms;`,
                    child: image(p, 103, 103, 18),
                });
                card.child.opacity = Math.round(
                    255 * Math.max(0.4, Math.min(1, Number(c.galleryOpacity) || 1)),
                );
                card.connect('clicked', () =>
                    Gio.AppInfo.launch_default_for_uri(
                        Gio.File.new_for_path(p).get_uri(),
                        global.create_app_launch_context(0, -1),
                    ),
                );
                place(root, card, 863 + (i % 2) * 116, 225 + Math.floor(i / 2) * 114, 112, 112);
            }
        }
        place(root, this._widget(createMusic, c, 'Música'), 869, 462, 220, 62);
        const dockApps = c.dockApps
            .map((id) => Shell.AppSystem.get_default().lookup_app(id))
            .filter(Boolean);
        const dockWidth = Math.max(200, 102 + 72 * dockApps.length);
        const dockX = (1200 - dockWidth) / 2;
        place(
            root,
            new St.Widget({
                style_class: 'ag-glass',
                style: `border-radius:42px;background-color:${rgba(t.raised, 0.9)};`,
            }),
            dockX,
            569,
            dockWidth,
            76,
        );
        const dock = place(
            root,
            new St.BoxLayout({
                style_class: 'ag-dock',
                style: 'background-color:transparent;border:0;box-shadow:none;',
            }),
            dockX,
            569,
            dockWidth,
            76,
        );
        dock.add_child(button('view-app-grid-symbolic', () => Main.overview.showApps()));
        for (const app of dockApps) dock.add_child(this._appButton(app, 36, c));
        const badge = place(
            root,
            new St.Button({
                style: `background-color:${rgba(t.raised, 0.92)};color:${t.foreground};border:1px solid ${rgba(t.border, 0.75)};border-radius:24px;padding:12px 22px;`,
                label: String(c.badgeTitle || 'Glass'),
                reactive: true,
            }),
            988,
            99,
            125,
            44,
        );
        const avatar = this._asset(c.gallery[0]);
        if (avatar) {
            const badgeContent = new St.BoxLayout({ style: 'spacing:7px;' });
            badgeContent.add_child(
                label(
                    String(c.badgeTitle || 'Glass').slice(0, 12),
                    `font-size:13px;font-weight:bold;color:${t.foreground};`,
                ),
            );
            badgeContent.add_child(image(avatar, 25, 25, 13));
            badge.set_child(badgeContent);
            badge.style = `background-color:${rgba(t.raised, 0.92)};color:${t.foreground};border:1px solid ${rgba(t.border, 0.75)};border-radius:24px;padding:8px 12px;`;
        }
        nativeSizeTree(root, scale, t);
        badge.connect('clicked', () => this.openPreferences());
    }
    _widget(factory, c, name) {
        try {
            return factory(c);
        } catch (e) {
            console.error('Anime Glass ' + name, e);
            return label(name + ' no disponible', 'font-size:14px;');
        }
    }
    _appButton(app, size, c) {
        const icon = app.create_icon_texture(size);
        const box = new St.BoxLayout({ orientation: Clutter.Orientation.VERTICAL });
        box.add_child(icon);
        const dot = label('•', 'font-size:11px;text-align:center;');
        box.add_child(dot);
        const tracker = Shell.WindowTracker.get_default();
        const update = () => {
            dot.opacity = app.get_state() === Shell.AppState.RUNNING ? 255 : 0;
            dot.style = `font-size:${11 * (dot._agNativeScale || 1)}px;text-align:center;color:${tracker.focus_app === app ? theme(c).accent : theme(c).muted};`;
        };
        update();
        const signal = app.connect('notify::state', update);
        const focusSignal = tracker.connect('notify::focus-app', update);
        const b = new St.Button({
            child: box,
            reactive: true,
            can_focus: true,
            track_hover: true,
            accessible_name: app.get_name(),
            style_class: 'ag-button',
            style: `transition-duration:${theme(c).animationDuration}ms;`,
        });
        const tip = label(
            app.get_name(),
            'font-size:12px;background-color:rgba(25,32,48,.9);padding:6px;border-radius:9px;',
        );
        let tipAlive = true;
        tip.connect('destroy', () => {
            tipAlive = false;
        });
        tip.visible = false;
        Main.layoutManager.addTopChrome(tip);
        b.connect('notify::hover', () => {
            if (!tipAlive) return;
            tip.visible = b.hover;
            if (b.hover) {
                const [x, y] = b.get_transformed_position();
                tip.set_position(x, y - 28);
            }
        });
        b.connect('clicked', () => app.activate());
        b.connect('destroy', () => {
            app.disconnect(signal);
            tracker.disconnect(focusSignal);
            if (tipAlive) {
                Main.layoutManager.removeChrome(tip);
                tip.destroy();
            }
        });
        return b;
    }
    disable() {
        if (this._reload) GLib.source_remove(this._reload);
        this._reload = 0;
        this._monitor?.cancel();
        this._monitor = null;
        for (const [o, id] of this._signals || []) o.disconnect(id);
        this._signals = [];
        this._clear();
    }
}
