"""Exercise lifecycle in temporary directories; no real GNOME mutations."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

FILE = Path(__file__).resolve().parents[1] / 'scripts/lifecycle.py'
spec = importlib.util.spec_from_file_location('lifecycle', FILE)
lifecycle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lifecycle)

class LifecycleTests(unittest.TestCase):
    def test_original_extension_and_settings_restored(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / 'project'
            dest = Path(temp) / 'extensions' / lifecycle.UUID
            (root / 'src').mkdir(parents=True)
            (root / 'backups').mkdir()
            (root / 'src/metadata.json').write_text(json.dumps({'uuid': lifecycle.UUID}))
            (root / 'src/extension.js').write_text('new')
            dest.mkdir(parents=True)
            (dest / 'extension.js').write_text('old')
            calls = []
            def fake_run(*args, check=True):
                calls.append(args)
                value = "'previous'\n" if args[:2] == ('gsettings','get') else ''
                return subprocess.CompletedProcess(args, 0, value, '')
            with patch.object(lifecycle, 'ROOT', root), patch.object(lifecycle, 'DEST', dest), patch.object(lifecycle, 'run', fake_run):
                lifecycle.install()
                self.assertEqual((dest / 'extension.js').read_text(), 'new')
                lifecycle.rollback(dry=True)
                self.assertEqual((dest / 'extension.js').read_text(), 'new')
                lifecycle.rollback()
                self.assertEqual((dest / 'extension.js').read_text(), 'old')
                sets = [x for x in calls if x[:2] == ('gsettings','set')]
                self.assertEqual(len(sets), 6)
                self.assertTrue(all(x[2] in lifecycle.SELECTED for x in sets))
                self.assertFalse(any('dconf' in x for x in calls))

    def test_rejects_wrong_uuid_before_install(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'src').mkdir()
            (root / 'backups').mkdir()
            (root / 'src/metadata.json').write_text('{"uuid":"wrong"}')
            with patch.object(lifecycle, 'ROOT', root), patch.object(lifecycle, 'run', return_value=subprocess.CompletedProcess([],0,"''",'')):
                with self.assertRaises(ValueError):
                    lifecycle.install()

class AutostartTests(unittest.TestCase):
    def test_configure_then_restore_owned_files_and_preserve_modified_font(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / 'project'
            dest = Path(temp) / 'extension'
            dest.mkdir()
            (root / 'backups').mkdir(parents=True)
            (root / 'assets/fonts').mkdir(parents=True)
            (root / 'assets/fonts/Orbitron.ttf').write_bytes(b'font')
            autostart = Path(temp) / 'autostart/anime.desktop'
            autostart.parent.mkdir()
            autostart.write_text('original desktop entry')
            font = Path(temp) / 'fonts/project/Orbitron.ttf'
            font.parent.mkdir(parents=True)
            calls = []
            def fake_run(*args, check=True):
                calls.append(args)
                value = '[]' if args[:2] == ('gsettings', 'get') else ''
                return subprocess.CompletedProcess(args, 0, value, '')
            with patch.object(lifecycle, 'ROOT', root), patch.object(lifecycle, 'DEST', dest), patch.object(lifecycle, 'AUTOSTART', autostart), patch.object(lifecycle, 'FONT', font), patch.object(lifecycle, 'run', fake_run):
                lifecycle.install_font(lifecycle.initial_backup())
                lifecycle.configure_autostart()
                self.assertIn('session.sh', autostart.read_text())
                self.assertTrue(any(x[:4] == ('gsettings','set','org.gnome.shell','enabled-extensions') and lifecycle.UUID in x[4] for x in calls))
                backup = Path((root/'backups/latest').read_text().strip())
                manifest = json.loads((backup/'managed-files.json').read_text())
                self.assertEqual(manifest['font']['installed_sha256'], lifecycle.checksum(font))
                font.write_bytes(b'user modified font')
                before = root/'before'
                before.mkdir()
                lifecycle.restore_managed_files(backup, before)
                self.assertEqual(autostart.read_text(), 'original desktop entry')
                self.assertEqual(font.read_bytes(), b'user modified font')
                font.write_bytes(b'font')
                lifecycle.restore_managed_files(backup, before)
                self.assertFalse(font.exists())

    def test_session_leaves_other_components_when_extension_inactive(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(lifecycle, 'ROOT', Path(temp)), patch.object(lifecycle.time, 'monotonic', side_effect=[0,31]), patch.object(lifecycle, 'run') as run:
            self.assertEqual(lifecycle.session(), 0)
            run.assert_not_called()

    def test_session_changes_components_only_after_active(self):
        with tempfile.TemporaryDirectory() as temp:
            config=Path(temp)/'config/settings.json';config.parent.mkdir();config.write_text(json.dumps({'integration':{'disableExtensions':['gridgets@rebatnaath.github.com','dash-to-dock@micxgx.gmail.com'],'stopHidamari':True}}))
            calls=[]
            def fake_run(*args, check=True):
                calls.append(args)
                value = 'gridgets@rebatnaath.github.com\ndash-to-dock@micxgx.gmail.com\n' if args[:2] == ('gnome-extensions','list') else '(true,)'
                return subprocess.CompletedProcess(args, 0, value, '')
            active = subprocess.CompletedProcess([],0,'  State: ACTIVE\n','')
            with patch.object(lifecycle, 'ROOT', Path(temp)), patch.object(lifecycle, 'run', fake_run), patch.object(lifecycle.subprocess,'run', return_value=active):
                self.assertEqual(lifecycle.session(),0)
            self.assertIn(('gnome-extensions','disable','gridgets@rebatnaath.github.com'),calls)
            self.assertIn(('gnome-extensions','disable','dash-to-dock@micxgx.gmail.com'),calls)
            self.assertTrue(any(x[-1] == 'io.github.jeffshee.hidamari.server.quit' for x in calls))

class PortabilityTests(unittest.TestCase):
    def test_install_records_checkout_and_preserves_user_settings(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)/'checkout with spaces';dest=Path(temp)/'extension'
            (root/'src').mkdir(parents=True);(root/'config').mkdir()
            (root/'src/metadata.json').write_text(json.dumps({'uuid':lifecycle.UUID}))
            (root/'src/extension.js').write_text('source')
            (root/'config/settings.example.json').write_text('{"name":"Demo"}')
            (root/'config/settings.json').write_text('{"name":"Keep me"}')
            with patch.object(lifecycle,'ROOT',root),patch.object(lifecycle,'DEST',dest),patch.object(lifecycle,'run',return_value=subprocess.CompletedProcess([],0,"''",'')) as run:
                lifecycle.install()
            self.assertEqual(json.loads((dest/'project-location.json').read_text())['root'],str(root))
            self.assertEqual(json.loads((root/'config/settings.json').read_text())['name'],'Keep me')
            self.assertFalse(any(call.args[:2]==('gnome-extensions','disable') for call in run.call_args_list))

    def test_active_session_does_not_disable_others_by_default(self):
        with tempfile.TemporaryDirectory() as temp:
            active=subprocess.CompletedProcess([],0,'State: ACTIVE\n','')
            with patch.object(lifecycle,'ROOT',Path(temp)),patch.object(lifecycle.subprocess,'run',return_value=active),patch.object(lifecycle,'run',return_value=subprocess.CompletedProcess([],0,'(true,)','')) as run:
                lifecycle.session()
            self.assertFalse(any('disable' in call.args or 'io.github.jeffshee.hidamari.server.quit' in call.args for call in run.call_args_list))

class FontOwnershipTests(unittest.TestCase):
    def test_preexisting_different_font_is_backed_up_and_restored(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)/'project';(root/'assets/fonts').mkdir(parents=True)
            (root/'assets/fonts/Orbitron.ttf').write_bytes(b'project font')
            font=Path(temp)/'fonts/Orbitron.ttf';font.parent.mkdir();font.write_bytes(b'previous font')
            backup=root/'backup';backup.mkdir();before=root/'before';before.mkdir()
            with patch.object(lifecycle,'ROOT',root),patch.object(lifecycle,'FONT',font),patch.object(lifecycle,'run',return_value=subprocess.CompletedProcess([],0,'','')):
                lifecycle.install_font(backup)
                self.assertEqual(font.read_bytes(),b'project font')
                lifecycle.restore_managed_files(backup,before)
                self.assertEqual(font.read_bytes(),b'previous font')

    def test_matching_preexisting_font_is_not_adopted(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)/'project';(root/'assets/fonts').mkdir(parents=True)
            (root/'assets/fonts/Orbitron.ttf').write_bytes(b'font')
            font=Path(temp)/'font.ttf';font.write_bytes(b'font')
            backup=root/'backup';backup.mkdir()
            with patch.object(lifecycle,'ROOT',root),patch.object(lifecycle,'FONT',font):
                lifecycle.install_font(backup)
            self.assertFalse((backup/'managed-files.json').exists())

if __name__ == '__main__':
    unittest.main()
