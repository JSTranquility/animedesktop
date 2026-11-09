#!/usr/bin/env python3
"""Per-user extension lifecycle. No root, remote code, or package removal."""
import ast
import configparser
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
UUID = 'anime-glass@jsttranquility'
DEST = Path.home() / '.local/share/gnome-shell/extensions' / UUID
AUTOSTART = Path.home() / '.config/autostart/anime-glass-desktop.desktop'
FONT = Path.home() / '.local/share/fonts/anime-glass-desktop/Orbitron.ttf'
SELECTED = {
    'org.gnome.desktop.background': ['picture-uri', 'picture-uri-dark', 'picture-options'],
    'org.gnome.shell': ['enabled-extensions', 'disabled-extensions', 'disable-user-extensions'],
}

def run(*args, check=True):
    return subprocess.run(args, text=True, capture_output=True, check=check, timeout=15, env={**os.environ, 'LC_ALL': 'C'})

def initial_backup():
    marker = ROOT / 'backups/latest'
    path = Path(marker.read_text().strip()) if marker.exists() else ROOT / 'backups' / datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    if not path.is_relative_to(ROOT / 'backups'):
        raise ValueError('Backup path outside project')
    path.mkdir(parents=True, exist_ok=True)
    settings = path / 'selected-settings.json'
    if not settings.exists():
        # Recover original values from the full audit dump where present.
        original = configparser.ConfigParser(interpolation=None)
        dump = path / 'gnome.dconf'
        if dump.exists():
            original.read(dump)
        values = {}
        for schema, keys in SELECTED.items():
            section = schema.removeprefix('org.gnome.').replace('.', '/')
            values[schema] = {}
            for key in keys:
                value = original.get(section, key, fallback=None)
                if value is None:
                    value = run('gsettings', 'get', schema, key).stdout.strip()
                values[schema][key] = value
        settings.write_text(json.dumps(values, indent=2) + '\n')
        marker.write_text(str(path) + '\n')
    return path

def install():
    backup = initial_backup()
    src = ROOT / 'src'
    meta = json.loads((src / 'metadata.json').read_text())
    if meta.get('uuid') != UUID or not (src / 'extension.js').is_file():
        raise ValueError('Invalid extension source')
    installed = backup / 'installed-extension.json'
    if not installed.exists():
        if DEST.is_symlink():
            raise ValueError('Existing extension is a symlink; refusing replacement')
        existed = DEST.exists()
        if existed:
            shutil.copytree(DEST, backup / 'extension-before')
        installed.write_text(json.dumps({'existed': existed, 'destination': str(DEST)}) + '\n')
    DEST.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, DEST, dirs_exist_ok=True)
    (DEST / 'project-location.json').write_text(json.dumps({'root': str(ROOT)}) + '\n')
    config = ROOT / 'config/settings.json'
    example = ROOT / 'config/settings.example.json'
    if not config.exists() and example.is_file():
        config.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(example, config)
    (ROOT / 'logs').mkdir(exist_ok=True)
    install_font(backup)
    print(f'Installed at {DEST}. No desktop preferences changed by install.')

def start():
    if not DEST.exists():
        raise ValueError('Run install.sh first')
    result = run('gnome-extensions', 'enable', UUID, check=False)
    if result.returncode:
        print(result.stderr.strip(), file=sys.stderr)
        print('A new extension may require logging out and back into GNOME Wayland to be discovered. No session restart was attempted.', file=sys.stderr)
        return result.returncode
    info = run('gnome-extensions', 'info', UUID, check=False)
    print(info.stdout)
    if 'ERROR' in info.stdout:
        return 1
    return 0

def stop():
    result = run('gnome-extensions', 'disable', UUID, check=False)
    print((result.stdout + result.stderr).strip())
    return result.returncode

def diagnose():
    output = []
    for cmd in [('gnome-shell', '--version'), ('gnome-extensions', 'info', UUID), ('gnome-extensions', 'list', '--enabled'), ('journalctl', '--user', '-b', '--no-pager', '-n', '100', '-g', 'anime-glass')]:
        result = run(*cmd, check=False)
        output.append('$ ' + ' '.join(cmd) + '\n' + result.stdout + result.stderr)
    output.append('Project: ' + str(ROOT) + '\nExtension: ' + str(DEST))
    log = ROOT / 'logs/diagnose.txt'
    log.parent.mkdir(exist_ok=True)
    log.write_text('\n'.join(output) + '\n')
    print(log.read_text())

def rollback(dry=False):
    marker = ROOT / 'backups/latest'
    if not marker.exists():
        raise ValueError('No initial backup marker')
    backup = Path(marker.read_text().strip())
    if not backup.is_relative_to(ROOT / 'backups'):
        raise ValueError('Backup path outside project')
    settings = json.loads((backup / 'selected-settings.json').read_text())
    print(f'Restore scoped GNOME background/extension preferences from {backup}')
    installed = backup / 'installed-extension.json'
    state = json.loads(installed.read_text()) if installed.exists() else None
    if dry:
        print(json.dumps(settings, indent=2))
        manifest = backup / 'managed-files.json'
        if manifest.exists():
            print(manifest.read_text())
        print('Dry run: no preferences or installed files changed')
        return
    stop()
    # Preserve current state too; rollback remains reversible.
    before = ROOT / 'backups' / ('before-rollback-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
    before.mkdir(parents=True, exist_ok=False)
    current = {s: {k: run('gsettings', 'get', s, k).stdout.strip() for k in ks} for s, ks in SELECTED.items()}
    (before / 'selected-settings.json').write_text(json.dumps(current, indent=2) + '\n')
    if state and DEST.exists():
        if DEST.is_symlink():
            raise ValueError('Refusing symlink removal')
        shutil.copytree(DEST, before / 'extension-current')
        shutil.rmtree(DEST)
    if state and state['existed']:
        shutil.copytree(backup / 'extension-before', DEST)
    restore_managed_files(backup, before)
    # Restore only keys covered by this project; never load the full dconf dump.
    for schema, pairs in settings.items():
        if schema not in SELECTED:
            continue
        for key, value in pairs.items():
            if key in SELECTED[schema]:
                run('gsettings', 'set', schema, key, value)
    print('Restored. Project assets and shared packages retained. A restored extension version may require the next login.')

def checksum(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def autostart_content():
    # Desktop Entry Exec quoting: escape reserved characters independently of shell.
    script = str(ROOT / 'scripts/session.sh')
    escaped = script.replace('\\', '\\\\').replace('"', '\\"').replace('`', '\\`').replace('$', '\\$').replace('%', '%%')
    return ('[Desktop Entry]\nType=Application\nName=Anime Glass Desktop integration\n'
            'Comment=Integrate widgets only after the GNOME extension is active\n'
            f'Exec="{escaped}"\nOnlyShowIn=GNOME;\nX-GNOME-Autostart-enabled=true\n'
            'NoDisplay=true\nTerminal=false\n')

def install_font(backup):
    source = ROOT / 'assets/fonts/Orbitron.ttf'
    if not source.is_file():
        return
    if FONT.is_symlink():
        raise ValueError('Refusing font symlink replacement')
    manifest_file = backup / 'managed-files.json'
    manifest = json.loads(manifest_file.read_text()) if manifest_file.exists() else {}
    if 'font' not in manifest:
        if FONT.exists() and checksum(FONT) == checksum(source):
            return  # A matching font already exists; do not adopt it for removal.
        existed = FONT.exists()
        if existed:
            shutil.copy2(FONT, backup / 'font-before.ttf')
        manifest['font'] = {'path': str(FONT), 'existed': existed,
                            'installed_sha256': checksum(source)}
    elif FONT.exists() and checksum(FONT) != manifest['font']['installed_sha256']:
        print('Preserving modified font:', FONT)
        return
    manifest_file.write_text(json.dumps(manifest, indent=2) + '\n')
    FONT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, FONT)
    run('fc-cache', str(FONT.parent), check=False)

def configure_autostart():
    if not DEST.is_dir():
        raise ValueError('Run install.sh before configuring autostart')
    backup = initial_backup()
    manifest_file = backup / 'managed-files.json'
    manifest = json.loads(manifest_file.read_text()) if manifest_file.exists() else {}
    if AUTOSTART.is_symlink() or FONT.is_symlink():
        raise ValueError('Refusing managed file symlinks')
    content = autostart_content()
    if 'autostart' not in manifest:
        existed = AUTOSTART.exists()
        if existed:
            shutil.copy2(AUTOSTART, backup / 'autostart-before.desktop')
        manifest['autostart'] = {'path': str(AUTOSTART), 'existed': existed,
                                 'installed_sha256': hashlib.sha256(content.encode()).hexdigest()}
    elif AUTOSTART.exists() and checksum(AUTOSTART) != manifest['autostart']['installed_sha256']:
        raise ValueError('Autostart file changed since installation; preserve it before reconfiguring')
    # Write restoration evidence before mutation.
    manifest_file.write_text(json.dumps(manifest, indent=2) + '\n')
    AUTOSTART.parent.mkdir(parents=True, exist_ok=True)
    AUTOSTART.write_text(content)
    for key in ['enabled-extensions', 'disabled-extensions']:
        raw = run('gsettings', 'get', 'org.gnome.shell', key).stdout.strip()
        values = ast.literal_eval(raw.removeprefix('@as ').strip())
        if not isinstance(values, list) or not all(isinstance(x, str) for x in values):
            raise ValueError('Invalid extension preference list')
        desired = list(values)
        if key == 'enabled-extensions' and UUID not in desired:
            desired.append(UUID)
        if key == 'disabled-extensions':
            desired = [x for x in desired if x != UUID]
        if desired != values:
            run('gsettings', 'set', 'org.gnome.shell', key, repr(desired))
    print('Autostart configured for the next GNOME login. No logout or session restart requested.')

def restore_managed_files(backup, before):
    manifest_file = backup / 'managed-files.json'
    if not manifest_file.exists():
        return
    manifest = json.loads(manifest_file.read_text())
    for name, path in [('autostart', AUTOSTART), ('font', FONT)]:
        entry = manifest.get(name)
        if not entry:
            continue
        if entry.get('path') != str(path) or path.is_symlink():
            print(f'Skipping unexpected managed path: {name}', file=sys.stderr)
            continue
        if path.exists():
            if not path.is_file() or checksum(path) != entry['installed_sha256']:
                print(f'Preserving modified file: {path}', file=sys.stderr)
                continue
            shutil.copy2(path, before / (name + '-current'))
            path.unlink()
        if entry['existed']:
            path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(backup / ('autostart-before.desktop' if name == 'autostart' else 'font-before.ttf'), path)
        elif name == 'font' and path.parent.exists():
            # Remove directory only if empty; additional user fonts are retained.
            try:
                path.parent.rmdir()
            except OSError:
                pass
    run('fc-cache', '-f', check=False)

def session():
    log_dir = ROOT / 'logs'
    log_dir.mkdir(exist_ok=True)
    with (log_dir / 'session.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('Another session integration instance is already running.')
            return 0
        deadline = time.monotonic() + 30
        active = False
        while time.monotonic() < deadline:
            try:
                result = subprocess.run(['gnome-extensions', 'info', UUID], text=True,
                    capture_output=True, timeout=min(2, max(.1, deadline-time.monotonic())),
                    env={**os.environ, 'LC_ALL': 'C'})
                active = result.returncode == 0 and any(line.strip() == 'State: ACTIVE' for line in result.stdout.splitlines())
            except subprocess.TimeoutExpired:
                active = False
            if active:
                break
            time.sleep(min(1, max(0, deadline-time.monotonic())))
        if not active:
            print('Extension did not become ACTIVE within 30 seconds; existing desktop components retained.')
            return 0
        # Integrations are opt-in in the public configuration.
        try:
            config = json.loads((ROOT / 'config/settings.json').read_text())
            integration = config.get('integration', {})
        except (OSError, ValueError):
            integration = {}
        requested = integration.get('disableExtensions', [])
        if not isinstance(requested, list):
            requested = []
        result = run('gnome-extensions', 'list', '--enabled', check=False)
        enabled = result.stdout.splitlines() if result.returncode == 0 else []
        for uuid in requested:
            if isinstance(uuid, str) and uuid != UUID and uuid in enabled:
                outcome = run('gnome-extensions', 'disable', uuid, check=False)
                print(f'Disable {uuid}: {outcome.returncode}')
        owner = run('gdbus', 'call', '--session', '--dest', 'org.freedesktop.DBus',
            '--object-path', '/org/freedesktop/DBus', '--method',
            'org.freedesktop.DBus.NameHasOwner', 'io.github.jeffshee.Hidamari.server', check=False)
        if integration.get('stopHidamari') is True and owner.returncode == 0 and 'true' in owner.stdout:
            outcome = run('gdbus', 'call', '--session', '--dest', 'io.github.jeffshee.Hidamari.server',
                '--object-path', '/io/github/jeffshee/Hidamari/server', '--method',
                'io.github.jeffshee.hidamari.server.quit', check=False)
            print(f'Hidamari session quit: {outcome.returncode}')
        print('Session integration finished once; no restart loop.')
        return 0

def main():
    action = sys.argv[1] if len(sys.argv) > 1 else 'diagnose'
    if action == 'snapshot':
        print(initial_backup())
    elif action == 'install':
        install()
    elif action == 'configure-autostart':
        configure_autostart()
    elif action == 'session':
        return session()
    elif action == 'start':
        return start()
    elif action == 'stop':
        return stop()
    elif action == 'restart':
        stop()
        return start()
    elif action == 'diagnose':
        diagnose()
    elif action == 'rollback':
        rollback('--dry-run' in sys.argv)
    else:
        raise ValueError('Unknown action')
    return 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        print(f'Anime Glass: {error}', file=sys.stderr)
        sys.exit(1)
