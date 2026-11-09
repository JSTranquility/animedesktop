import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// Event driven: one discovery call, then NameOwnerChanged and property signals.
export class MprisService {
    constructor(onChange) {
        this._onChange = onChange;
        this._players = new Map();
        this._pending = new Set();
        this._cancel = new Gio.Cancellable();
        this._dead = false;
        this._subscription = Gio.DBus.session.signal_subscribe(
            'org.freedesktop.DBus',
            'org.freedesktop.DBus',
            'NameOwnerChanged',
            '/org/freedesktop/DBus',
            null,
            Gio.DBusSignalFlags.NONE,
            (_c, _s, _p, _i, _n, v) => {
                const [name, , owner] = v.deepUnpack();
                if (!name.startsWith('org.mpris.MediaPlayer2.')) return;
                if (owner) this._add(name);
                else this._remove(name);
            },
        );
        Gio.DBus.session.call(
            'org.freedesktop.DBus',
            '/org/freedesktop/DBus',
            'org.freedesktop.DBus',
            'ListNames',
            null,
            null,
            Gio.DBusCallFlags.NONE,
            3000,
            this._cancel,
            (bus, result) => {
                try {
                    const [names] = bus.call_finish(result).deepUnpack();
                    for (const name of names)
                        if (name.startsWith('org.mpris.MediaPlayer2.')) this._add(name);
                } catch (error) {
                    if (!this._dead) console.warn(`Anime Glass MPRIS discovery: ${error.message}`);
                }
            },
        );
    }
    _add(name) {
        if (this._dead || this._players.has(name) || this._pending.has(name)) return;
        this._pending.add(name);
        Gio.DBusProxy.new(
            Gio.DBus.session,
            Gio.DBusProxyFlags.DO_NOT_AUTO_START | Gio.DBusProxyFlags.GET_INVALIDATED_PROPERTIES,
            null,
            name,
            '/org/mpris/MediaPlayer2',
            'org.mpris.MediaPlayer2.Player',
            this._cancel,
            (_source, result) => {
                this._pending.delete(name);
                try {
                    const proxy = Gio.DBusProxy.new_finish(result);
                    if (this._dead || !proxy.g_name_owner) return;
                    const signal = proxy.connect('g-properties-changed', () => this._onChange());
                    this._players.set(name, { proxy, signal });
                    this._onChange();
                } catch (error) {
                    if (!this._dead) console.warn(`Anime Glass MPRIS player: ${error.message}`);
                }
            },
        );
    }
    _remove(name) {
        const p = this._players.get(name);
        if (p) {
            p.proxy.disconnect(p.signal);
            this._players.delete(name);
            this._onChange();
        }
    }
    get active() {
        return (
            [...this._players.values()].find(
                (p) => this.property(p.proxy, 'PlaybackStatus') === 'Playing',
            )?.proxy ??
            [...this._players.values()][0]?.proxy ??
            null
        );
    }
    property(proxy, key, fallback = null) {
        return proxy?.get_cached_property(key)?.deepUnpack() ?? fallback;
    }
    get state() {
        const proxy = this.active;
        if (!proxy)
            return {
                available: false,
                title: 'Sin reproducción',
                artist: 'Abre un reproductor',
                playing: false,
                artUrl: null,
                canPrevious: false,
                canNext: false,
                canPlay: false,
            };
        const metadata = this.property(proxy, 'Metadata', {});
        const value = (key, fallback) => {
            const v = metadata[key];
            return v?.deepUnpack?.() ?? v ?? fallback;
        };
        const artists = value('xesam:artist', []);
        return {
            available: true,
            title: String(value('xesam:title', 'Sin título')),
            artist: Array.isArray(artists) ? artists.join(', ') : String(artists),
            artUrl: value('mpris:artUrl', null),
            playing: this.property(proxy, 'PlaybackStatus') === 'Playing',
            canPrevious: this.property(proxy, 'CanGoPrevious', false),
            canNext: this.property(proxy, 'CanGoNext', false),
            canPlay:
                this.property(proxy, 'CanControl', false) &&
                (this.property(proxy, 'CanPlay', false) || this.property(proxy, 'CanPause', false)),
        };
    }
    command(method) {
        if (!['Previous', 'Next', 'PlayPause'].includes(method)) return;
        const proxy = this.active;
        if (!proxy) return;
        proxy.call(method, null, Gio.DBusCallFlags.NONE, 3000, this._cancel, (p, result) => {
            try {
                p.call_finish(result);
            } catch (error) {
                if (!this._dead) console.warn(`Anime Glass MPRIS control: ${error.message}`);
            }
        });
    }
    destroy() {
        this._dead = true;
        this._cancel.cancel();
        if (this._subscription) Gio.DBus.session.signal_unsubscribe(this._subscription);
        this._subscription = 0;
        for (const { proxy, signal } of this._players.values()) proxy.disconnect(signal);
        this._players.clear();
        this._onChange = () => {};
    }
}
