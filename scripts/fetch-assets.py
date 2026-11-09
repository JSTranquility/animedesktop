#!/usr/bin/env python3
"""Fetch optional artwork locally; never execute downloaded content."""
import argparse
import base64
import datetime
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
MAX_BYTES = 32 * 1024 * 1024

def destination(relative):
    path = Path(relative)
    if path.is_absolute() or '..' in path.parts or not path.parts or path.parts[0] != 'assets':
        raise ValueError('Asset path must stay inside assets/')
    target = ROOT / path
    if not target.resolve().is_relative_to((ROOT / 'assets').resolve()):
        raise ValueError('Asset path escapes the checkout')
    return target

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def image_signature(header):
    return header.startswith(b'\xff\xd8\xff') or header.startswith(b'\x89PNG\r\n\x1a\n') or (header.startswith(b'RIFF') and header[8:12] == b'WEBP')

def fetch(item, opener=urllib.request.urlopen):
    if urllib.parse.urlparse(item['url']).scheme != 'https':
        raise ValueError('Only HTTPS artwork URLs are supported')
    accepted_hashes = {item['sha256'], *item.get('alternateSha256', [])}
    target = destination(item['path'])
    if target.exists():
        if digest(target) not in accepted_hashes:
            raise ValueError(f'Preserving modified asset: {target}')
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(item['url'], headers={'User-Agent': 'Mozilla/5.0 AnimeDesktop/0.1'})
    temporary = None
    try:
        with opener(request, timeout=30) as response, tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as output:
            temporary = Path(output.name)
            if urllib.parse.urlparse(response.geturl()).scheme != 'https':
                raise ValueError('Artwork redirected outside HTTPS')
            total = 0
            while block := response.read(65536):
                total += len(block)
                if total > MAX_BYTES:
                    raise ValueError('Artwork exceeds download limit')
                output.write(block)
        with temporary.open('rb') as source:
            if not image_signature(source.read(16)):
                raise ValueError('Response is not a supported image')
        if digest(temporary) not in accepted_hashes:
            raise ValueError('Artwork changed upstream; review its source and checksum')
        temporary.replace(target)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)

def compose_wallpaper():
    original = destination('assets/wallpapers/chisa/crimson-portrait.jpg')
    encoded = base64.b64encode(original.read_bytes()).decode()
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="3840" height="2160"><rect width="3840" height="2160" fill="#08080b"/><image width="3840" height="2160" xlink:href="data:image/jpeg;base64,{encoded}"/><rect width="3840" height="2160" fill="#060609" opacity="0.72"/><defs><radialGradient id="v"><stop stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.36"/></radialGradient></defs><rect width="3840" height="2160" fill="url(#v)"/></svg>'
    destination('assets/wallpapers/chisa/chisa-midnight.svg').write_text(svg)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', choices=['chisa'], required=True)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--activate', action='store_true', help='Back up and select the downloaded profile locally')
    args = parser.parse_args()
    manifest = json.loads((ROOT / 'assets/chisa-sources.json').read_text())
    print(manifest['notice'])
    for item in manifest['files']:
        destination(item['path'])
        if args.dry_run:
            print(item['path'], '<-', item['url'])
        else:
            fetch(item)
    if args.dry_run:
        return
    compose_wallpaper()
    if args.activate:
        target = ROOT / 'config/settings.json'
        if target.exists():
            backup = ROOT / 'backups' / ('profile-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
            backup.mkdir(parents=True, exist_ok=False)
            shutil.copy2(target, backup / 'settings.json')
        shutil.copy2(ROOT / 'config/chisa.example.json', target)
    print('Artwork ready locally. Downloaded images remain excluded from Git.')

if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError) as error:
        raise SystemExit(f'Artwork download failed: {error}') from None
