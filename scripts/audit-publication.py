#!/usr/bin/env python3
"""Check the Git index for private state and unbundled artwork before publication."""
from pathlib import Path
import re
import subprocess
import sys

ROOT=Path(__file__).resolve().parent.parent

def inspect(paths, blobs=None, modes=None):
    errors=[]
    forbidden=('backups/','logs/','dist/','assets/characters/','assets/gallery/','assets/wallpapers/')
    private={'config/settings.json','config/pending-settings.json'}
    signatures=[re.compile(r'-----BEGIN (?:OPENSSH|RSA|EC|DSA) PRIVATE KEY-----'),re.compile(r'gh[pousr]_[A-Za-z0-9]{20,}'),re.compile(r'github_pat_[A-Za-z0-9_]{30,}'),re.compile(r'/home/[A-Za-z0-9_.-]+/')]
    for relative in paths:
        path=ROOT/relative
        if relative.startswith(forbidden) or relative in private or (Path(relative).name=='project-location.json' or (Path(relative).name.startswith('.env') and Path(relative).name!='.env.example') or relative.endswith(('.local.json','.pem','.key','.dconf','.tar.gz','.zip'))) or '__pycache__' in Path(relative).parts:
            errors.append((relative,'private/generated file or downloaded artwork'))
        if (modes or {}).get(relative)=='120000' or (modes is None and path.is_symlink()):
            errors.append((relative,'symlink requires manual review'));continue
        if blobs is None and not path.is_file():continue
        try:content=blobs[relative].decode() if blobs is not None else path.read_text()
        except UnicodeError:continue
        for pattern in signatures:
            if pattern.search(content):errors.append((relative,'private path or credential signature'));break
        if path.suffix=='.svg' and 'data:image/' in content:
            errors.append((relative,'embedded bitmap artwork'))
    return errors

def main():
    result=subprocess.run(['git','-C',str(ROOT),'ls-files','-z'],capture_output=True,check=True)
    paths=[p for p in result.stdout.decode().split('\0') if p]
    if not paths:raise SystemExit('No staged/tracked files; add the intended public files first.')
    entries=subprocess.run(['git','-C',str(ROOT),'ls-files','--stage','-z'],capture_output=True,check=True).stdout.decode().split('\0')
    blobs={};modes={}
    for entry in filter(None,entries):
        header,relative=entry.split('\t',1);mode,oid,stage=header.split()
        if stage!='0':raise SystemExit('Resolve Git conflicts before publication.')
        modes[relative]=mode;blobs[relative]=subprocess.run(['git','-C',str(ROOT),'cat-file','blob',oid],capture_output=True,check=True).stdout
    errors=inspect(paths,blobs,modes)
    for path,reason in errors:print(f'REVIEW {path}: {reason}',file=sys.stderr)
    if errors:raise SystemExit(1)
    print(f'PASS: {len(paths)} public files; no private state, downloaded artwork or credential signatures detected.')

if __name__=='__main__':main()
