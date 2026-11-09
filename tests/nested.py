#!/usr/bin/env python3
"""Run an isolated headless GNOME; never replace or alter the real session."""
from pathlib import Path
import tempfile,os,subprocess,shutil,sys,json,signal
project=Path(__file__).resolve().parent.parent
(project/'logs').mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix='anime-glass-test-') as temp:
 root=Path(temp)
 env=dict(os.environ,XDG_CONFIG_HOME=str(root/'config'),XDG_DATA_HOME=str(root/'data'),XDG_CACHE_HOME=str(root/'cache'),GSETTINGS_BACKEND='keyfile',SHELL_BACKGROUND_IMAGE=str(project/'assets/wallpapers/tokyo-daylight.png'))
 test_project=root/'project';(test_project/'config').mkdir(parents=True)
 config_source=Path(os.environ.get('ANIME_GLASS_TEST_CONFIG',project/'config/settings.example.json'))
 shutil.copy2(config_source,test_project/'config/settings.json')
 shutil.copy2(project/'config/settings.example.json',test_project/'config/settings.example.json')
 pending_config=os.environ.get('ANIME_GLASS_TEST_PENDING')
 if pending_config:shutil.copy2(pending_config,test_project/'config/pending-settings.json')
 wallpaper=json.loads(Path(pending_config or config_source).read_text()).get('wallpaper','assets/wallpapers/tokyo-daylight.png')
 env['SHELL_BACKGROUND_IMAGE']=str(project/wallpaper)
 (test_project/'assets').symlink_to(project/'assets',target_is_directory=True)
 env['ANIME_GLASS_HOME']=str(test_project)
 env['ANIMEDESKTOP_HOME']=str(test_project)
 env['ANIME_GLASS_TEST_OUTPUT']=str(project/'logs/nested.png')
 if '--preferences' in sys.argv:
  env['ANIMEDESKTOP_TEST_PREFS']='1'
  env['ANIMEDESKTOP_PREFS_READY']=str(root/'prefs-ready')
  env['ANIMEDESKTOP_PREFS_OUTPUT']=str(project/'logs/preferences.png')
 shutil.copytree(project/'src',root/'data/gnome-shell/extensions/anime-glass@jsttranquility')
 shutil.copytree(project/'assets/fonts',root/'data/fonts/anime-glass')
 settings=root/'config/glib-2.0/settings/keyfile';settings.parent.mkdir(parents=True)
 settings.write_text('[org/gnome/shell]\nenabled-extensions=["anime-glass@jsttranquility"]\n')
 apps=root/'data/applications';apps.mkdir(parents=True)
 marker=root/'launcher-worked'
 (apps/'anime-glass-test.desktop').write_text(f'[Desktop Entry]\nType=Application\nName=Anime Glass Test\nExec=/usr/bin/touch {marker}\nIcon=application-x-executable\n')
 env['ANIME_GLASS_LAUNCH_MARKER']=str(marker)
 invalid=root/'invalid.json';invalid.write_text('{bad config')
 env['ANIME_GLASS_INVALID_CONFIG']=str(invalid)
 args=['dbus-run-session','--','gnome-shell','--headless','--virtual-monitor','1920x1080','--wayland-display','anime-glass-test','--automation-script',str(project/'tests/shell-test.js')]
 if '--dual' in sys.argv:args.extend(['--virtual-monitor','1280x1024'])
 name='dual-test.log' if '--dual' in sys.argv else 'fullhd-test.log'
 with (project/'logs'/name).open('w') as log:
  process=subprocess.Popen(args,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  try:code=process.wait(timeout=45)
  except subprocess.TimeoutExpired:
   os.killpg(process.pid,signal.SIGTERM)
   try:process.wait(timeout=5)
   except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL);process.wait()
   raise

 print(name, 'exit',code)
 print('\n'.join(x for x in (project/'logs'/name).read_text().splitlines() if 'AG_TEST' in x))
 sys.exit(code)
