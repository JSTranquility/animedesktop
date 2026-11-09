import { theme } from '../themes/tokens.js';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

export function createClock(config = {}) {
    const colors = theme(config);
    const box = new St.BoxLayout({
        orientation: Clutter.Orientation.VERTICAL,
        width: 205,
        height: 105,
    });
    const time = new St.Label({
        style: `font-family: Orbitron; font-size: 38px; font-weight: 500; color: ${colors.foreground};`,
        x_align: Clutter.ActorAlign.CENTER,
    });
    const date = new St.Label({
        style: `font-family: monospace; font-size: 14px; color: ${colors.muted};`,
        x_align: Clutter.ActorAlign.CENTER,
    });
    box.add_child(time);
    box.add_child(date);
    let timer = 0;
    const render = () => {
        const now = GLib.DateTime.new_now_local();
        const format =
            typeof config.clockFormat === 'string' && config.clockFormat.length < 80
                ? config.clockFormat
                : '%H:%M';
        time.text = now.format(format) || now.format('%H:%M');
        try {
            date.text = new Intl.DateTimeFormat(config.locale || undefined, {
                weekday: 'long',
                month: '2-digit',
                day: '2-digit',
            }).format(new Date());
        } catch (_) {
            try {
                date.text = new Intl.DateTimeFormat(config.locale || undefined, {
                    weekday: 'long',
                    month: '2-digit',
                    day: '2-digit',
                }).format(new Date());
            } catch (_) {
                date.text = now.format('%A  %m/%d');
            }
        }
    };
    const tick = () => {
        render();
        const now = GLib.DateTime.new_now_local();
        timer = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            !config.performanceMode && /%[ST]/.test(config.clockFormat || '')
                ? 1
                : Math.max(1, 60 - now.get_second()),
            () => {
                timer = 0;
                tick();
                return GLib.SOURCE_REMOVE;
            },
        );
    };
    tick();
    box.connect('destroy', () => {
        if (timer) GLib.source_remove(timer);
        timer = 0;
    });
    return box;
}
