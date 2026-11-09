import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('audit',Path(__file__).resolve().parents[1]/'scripts/audit-publication.py')
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
class PublicationTests(unittest.TestCase):
    def test_blocks_force_added_private_files_and_artwork(self):
        with tempfile.TemporaryDirectory() as temp,patch.object(audit,'ROOT',Path(temp)):
            errors=audit.inspect(['backups/initial.dconf','config/settings.json','logs/session.log','assets/characters/chisa.webp'])
            self.assertEqual(len(errors),4)
    def test_blocks_home_paths_and_embedded_artwork(self):
        with tempfile.TemporaryDirectory() as temp,patch.object(audit,'ROOT',Path(temp)):
            p=Path(temp);(p/'bad.txt').write_text('/home/'+'someone/config');(p/'bad.svg').write_text('<image href="data:image/jpeg;base64,aaa"/>')
            self.assertEqual(len(audit.inspect(['bad.txt','bad.svg'])),2)
    def test_accepts_generic_paths_and_vectors(self):
        with tempfile.TemporaryDirectory() as temp,patch.object(audit,'ROOT',Path(temp)):
            (Path(temp)/'README.md').write_text('Use ~/Projects/animedesktop and config/settings.example.json')
            self.assertEqual(audit.inspect(['README.md']),[])
if __name__=='__main__':unittest.main()
