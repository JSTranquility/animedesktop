// Run under dbus-run-session so existing music players cannot affect selection.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { MprisService } from '../src/services/mpris.js';
const xml = `<node><interface name="org.mpris.MediaPlayer2.Player"><method name="PlayPause"/><method name="Next"/><method name="Previous"/><property name="PlaybackStatus" type="s" access="read"/><property name="Metadata" type="a{sv}" access="read"/><property name="CanControl" type="b" access="read"/><property name="CanPlay" type="b" access="read"/><property name="CanPause" type="b" access="read"/><property name="CanGoNext" type="b" access="read"/><property name="CanGoPrevious" type="b" access="read"/></interface></node>`;
const loop = new GLib.MainLoop(null, false);
const calls = new Set();
let service = null,
    exported = null,
    passed = false,
    owner = 0,
    phase = 'discover',
    failure = null;
const assert = (value, message) => {
    if (!value) throw new Error(message);
};
const fail = (error) => {
    failure = error;
    loop.quit();
};
function commandReceived(method) {
    calls.add(method);
    if (calls.size !== 3) return;
    phase = 'metadata';
    fixture.Metadata = {
        'xesam:title': new GLib.Variant('s', 'Updated title'),
        'xesam:artist': new GLib.Variant('as', ['Updated artist']),
    };
    fixture.PlaybackStatus = 'Paused';
    fixture.CanGoNext = false;
    fixture.CanGoPrevious = false;
    fixture.CanPlay = false;
    fixture.CanPause = false;
    exported.emit_property_changed('Metadata', new GLib.Variant('a{sv}', fixture.Metadata));
    exported.emit_property_changed('PlaybackStatus', new GLib.Variant('s', 'Paused'));
    for (const key of ['CanGoNext', 'CanGoPrevious', 'CanPlay', 'CanPause'])
        exported.emit_property_changed(key, new GLib.Variant('b', false));
    exported.flush();
}
const fixture = {
    PlaybackStatus: 'Playing',
    Metadata: {
        'xesam:title': new GLib.Variant('s', 'Anime Glass fixture'),
        'xesam:artist': new GLib.Variant('as', ['Test artist']),
    },
    CanControl: true,
    CanPlay: true,
    CanPause: true,
    CanGoNext: true,
    CanGoPrevious: true,
    PlayPause() {
        commandReceived('PlayPause');
    },
    Next() {
        commandReceived('Next');
    },
    Previous() {
        commandReceived('Previous');
    },
};
function changed() {
    try {
        const state = service.state;
        if (phase === 'discover' && state.available) {
            assert(
                state.title === 'Anime Glass fixture' && state.artist === 'Test artist',
                'Initial metadata',
            );
            assert(
                state.playing && state.canNext && state.canPrevious && state.canPlay,
                'Initial capabilities',
            );
            phase = 'commands';
            for (const method of ['Previous', 'PlayPause', 'Next']) service.command(method);
        } else if (
            phase === 'metadata' &&
            state.title === 'Updated title' &&
            !state.playing &&
            !state.canNext &&
            !state.canPrevious &&
            !state.canPlay
        ) {
            assert(state.artist === 'Updated artist', 'PropertiesChanged artist');
            phase = 'release';
            Gio.bus_unown_name(owner);
            owner = 0;
        } else if (phase === 'release' && !state.available) {
            assert(
                !state.canPlay && !state.canPrevious && !state.canNext && !state.playing,
                'Closed player disables all controls',
            );
            assert(service.active === null, 'Closed player removes active proxy');
            const before = calls.size;
            for (const method of ['Previous', 'PlayPause', 'Next']) service.command(method);
            assert(calls.size === before, 'No player commands are no-ops');
            passed = true;
            loop.quit();
        }
    } catch (error) {
        fail(error);
    }
}
owner = Gio.bus_own_name(
    Gio.BusType.SESSION,
    'org.mpris.MediaPlayer2.AnimeGlassFixture',
    Gio.BusNameOwnerFlags.NONE,
    (bus) => {
        exported = Gio.DBusExportedObject.wrapJSObject(xml, fixture);
        exported.export(bus, '/org/mpris/MediaPlayer2');
    },
    () => {
        service = new MprisService(changed);
    },
    () => {
        if (phase !== 'release') fail(new Error('Fixture name unavailable'));
    },
);
const timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
    fail(new Error(`Timeout in phase ${phase}`));
    return GLib.SOURCE_REMOVE;
});
loop.run();
GLib.source_remove(timeout);
service?.destroy();
exported?.unexport();
if (owner) Gio.bus_unown_name(owner);
if (!passed) throw failure ?? new Error('MPRIS fixture did not pass');
print(
    'PASS: discovery; title/artist; playing state; Previous, PlayPause, Next dispatch; PropertiesChanged metadata/state/capabilities; released player unavailable; disabled controls; no-player command safety; cleanup',
);
