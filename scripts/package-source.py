#!/usr/bin/env python3
"""Build a source archive from the reviewed Git index, without personal assets."""
from pathlib import Path
import json
import subprocess
import zipfile
ROOT=Path(__file__).resolve().parent.parent
subprocess.run(['python3',str(ROOT/'scripts/audit-publication.py')],check=True)
version=json.loads(subprocess.run(['git','-C',str(ROOT),'show',':package.json'],capture_output=True,text=True,check=True).stdout)['version']
out=ROOT/'dist'/f'animedesktop-{version}.zip';out.parent.mkdir(exist_ok=True)
entries=subprocess.run(['git','-C',str(ROOT),'ls-files','--stage','-z'],capture_output=True,check=True).stdout.decode().split('\0')
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED) as archive:
    for entry in filter(None,entries):
        header,relative=entry.split('\t',1);mode,oid,stage=header.split()
        if stage!='0':raise SystemExit('Resolve Git conflicts before packaging')
        data=subprocess.run(['git','-C',str(ROOT),'cat-file','blob',oid],capture_output=True,check=True).stdout
        info=zipfile.ZipInfo(f'animedesktop-{version}/{relative}',date_time=(1980,1,1,0,0,0))
        info.external_attr=int(mode,8)<<16;info.compress_type=zipfile.ZIP_DEFLATED
        archive.writestr(info,data)
print(out)
