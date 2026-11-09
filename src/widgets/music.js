import { theme, rgba } from '../themes/tokens.js';
import St from 'gi://St';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import { MprisService } from '../services/mpris.js';

export function createMusic(config = {}) {
    const colors = theme(config);
    const box = new St.BoxLayout({
        width: 220,
        height: 60,
        style: `background-color:${rgba(colors.raised, 0.92)};border:1px solid ${rgba(colors.border, 0.7)};border-radius:18px;padding:7px 10px;spacing:9px;`,
    });
    const art = new St.Icon({
        icon_name: 'audio-x-generic-symbolic',
        icon_size: 35,
        y_align: Clutter.ActorAlign.CENTER,
        style: `border-radius:24px; color:${colors.foreground};`,
    });
    box.add_child(art);
    const body = new St.BoxLayout({ orientation: Clutter.Orientation.VERTICAL, width: 152 });
    box.add_child(body);
    const title = new St.Label({
        style: `font-family:Sans;font-size:11px;font-weight:bold;color:${colors.foreground};`,
        width: 152,
    });
    title.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    const artist = new St.Label({ style: `font-size:9px;color:${colors.muted};`, width: 152 });
    artist.clutter_text.ellipsize = Pango.EllipsizeMode.END;
    body.add_child(title);
    body.add_child(artist);
    const controls = new St.BoxLayout({ style: 'spacing:9px;' });
    body.add_child(controls);
    let service;
    const button = (icon, method, name) => {
        const b = new St.Button({
            child: new St.Icon({ icon_name: icon, icon_size: 12 }),
            accessible_name: name,
            style: `color:${colors.foreground};`,
        });
        b.connect('clicked', () => service.command(method));
        controls.add_child(b);
        return b;
    };
    const previous = button('media-skip-backward-symbolic', 'Previous', 'Previous track');
    const play = button('media-playback-start-symbolic', 'PlayPause', 'Play or pause');
    const next = button('media-skip-forward-symbolic', 'Next', 'Next track');
    let lastArt = null,
        artGeneration = 0,
        dead = false;
    const cancel = new Gio.Cancellable();
    const session = new Soup.Session({ timeout: 8, user_agent: 'AnimeGlassDesktop/1.0' });
    const render = () => {
        const state = service.state;
        title.text = state.title;
        artist.text = state.artist;
        previous.reactive = state.canPrevious;
        next.reactive = state.canNext;
        play.reactive = state.canPlay;
        previous.opacity = state.canPrevious ? 255 : 90;
        next.opacity = state.canNext ? 255 : 90;
        play.opacity = state.canPlay ? 255 : 90;
        play.child.icon_name = state.playing
            ? 'media-playback-pause-symbolic'
            : 'media-playback-start-symbolic';
        if (state.artUrl !== lastArt) {
            lastArt = state.artUrl;
            // Local artwork and asynchronous HTTPS covers; failures keep the music placeholder.
            try {
                const file = state.artUrl?.startsWith('file://')
                    ? Gio.File.new_for_uri(state.artUrl)
                    : null;
                art.gicon = file?.query_exists(null) ? new Gio.FileIcon({ file }) : null;
                if (!art.gicon) art.icon_name = 'audio-x-generic-symbolic';
                const generation = ++artGeneration;
                if (
                    !file &&
                    typeof state.artUrl === 'string' &&
                    state.artUrl.startsWith('https://')
                ) {
                    const message = Soup.Message.new('GET', state.artUrl);
                    if (message) {
                        // Refuse oversized declared bodies before consuming them.
                        message.connect('got-headers', () => {
                            if (message.response_headers.get_content_length() > 8 * 1024 * 1024)
                                session.abort();
                        });
                        session.send_and_read_async(
                            message,
                            GLib.PRIORITY_DEFAULT,
                            cancel,
                            (source, result) => {
                                try {
                                    const bytes = source.send_and_read_finish(result);
                                    if (
                                        !dead &&
                                        generation === artGeneration &&
                                        message.status_code === 200 &&
                                        bytes.get_size() <= 8 * 1024 * 1024
                                    )
                                        art.gicon = new Gio.BytesIcon({ bytes });
                                } catch (_) {
                                    /* Offline covers are optional. */
                                }
                            },
                        );
                    }
                }
            } catch (_) {
                art.gicon = null;
                art.icon_name = 'audio-x-generic-symbolic';
            }
        }
    };
    service = new MprisService(render);
    render();
    box.connect('destroy', () => {
        dead = true;
        cancel.cancel();
        session.abort();
        service.destroy();
    });
    return box;
}
