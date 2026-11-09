import { theme, rgba } from '../themes/tokens.js';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import { monthCells, shiftMonth } from './calendar-model.js';

export function createCalendar(config = {}) {
    const colors = theme(config);
    const box = new St.BoxLayout({
        orientation: Clutter.Orientation.VERTICAL,
        width: 185,
        height: 235,
        style: `background-color: ${rgba(colors.surface, 0.94)}; border:1px solid ${rgba(colors.border, 0.6)}; border-radius: 21px; padding: 13px 16px; color: ${colors.foreground};`,
    });
    let now = new Date(),
        year = now.getFullYear(),
        month = now.getMonth();
    const header = new St.BoxLayout({ style: 'spacing: 3px; margin-bottom: 8px;' });
    const prev = new St.Button({ label: '‹', accessible_name: 'Previous month', width: 21 });
    const title = new St.Button({
        x_expand: true,
        style: 'font-size:17px; font-weight:bold;',
        accessible_name: 'Return to current month',
    });
    const next = new St.Button({ label: '›', accessible_name: 'Next month', width: 21 });
    header.add_child(prev);
    header.add_child(title);
    header.add_child(next);
    box.add_child(header);
    const grid = new St.Widget({ layout_manager: new Clutter.GridLayout(), x_expand: true });
    box.add_child(grid);
    const render = () => {
        grid.destroy_all_children();
        now = new Date();
        let locale = typeof config.locale === 'string' ? config.locale : undefined;
        try {
            title.label = new Intl.DateTimeFormat(locale, {
                month: 'long',
                ...(year !== now.getFullYear() ? { year: 'numeric' } : {}),
            }).format(new Date(year, month, 1));
        } catch (_) {
            title.label = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(
                new Date(year, month, 1),
            );
        }
        const layout = grid.layout_manager;
        for (let i = 0; i < 7; i++) {
            const d = new Date(2024, 0, 1 + i);
            let label;
            try {
                label = new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(d);
            } catch (_) {
                label = ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i];
            }
            layout.attach(
                new St.Label({
                    text: label,
                    width: 21,
                    height: 22,
                    x_align: Clutter.ActorAlign.CENTER,
                    style: `font-size:10px;color:${colors.muted};`,
                }),
                i,
                0,
                1,
                1,
            );
        }
        monthCells(year, month).forEach((day, i) => {
            const today =
                day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
            layout.attach(
                new St.Label({
                    text: day ? String(day) : '',
                    width: 21,
                    height: 24,
                    x_align: Clutter.ActorAlign.CENTER,
                    style: `font-size:12px; ${today ? `font-weight:bold;color:${colors.accent};border-bottom:2px solid ${colors.accent};` : ''}`,
                }),
                i % 7,
                Math.floor(i / 7) + 1,
                1,
                1,
            );
        });
    };
    prev.connect('clicked', () => {
        [year, month] = shiftMonth(year, month, -1);
        render();
    });
    next.connect('clicked', () => {
        [year, month] = shiftMonth(year, month, 1);
        render();
    });
    title.connect('clicked', () => {
        now = new Date();
        year = now.getFullYear();
        month = now.getMonth();
        render();
    });
    const line = new St.Widget({
        height: 5,
        width: 58,
        x_align: Clutter.ActorAlign.CENTER,
        style: `background-color:${colors.accent}; border-radius:4px; margin-top:7px;`,
    });
    box.add_child(line);
    let lastDay = now.toDateString();
    const timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 60, () => {
        const day = new Date().toDateString();
        if (day !== lastDay) {
            lastDay = day;
            render();
        }
        return GLib.SOURCE_CONTINUE;
    });
    box.connect('destroy', () => GLib.source_remove(timer));
    render();
    return box;
}
