import hashlib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('fetch_assets',Path(__file__).resolve().parents[1]/'scripts/fetch-assets.py')
assets=importlib.util.module_from_spec(spec);spec.loader.exec_module(assets)

class Response(io.BytesIO):
    def geturl(self):return 'https://example.invalid/image.png'

class AssetTests(unittest.TestCase):
    def test_rejects_traversal_and_symlink_escape(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(assets,'ROOT',Path(temp)):
            root=Path(temp);(root/'assets').mkdir();(root/'assets/link').symlink_to(root.parent,target_is_directory=True)
            for bad in ['../secret','/etc/passwd','assets/../../secret','config/settings.json','assets/link/outside.png']:
                with self.assertRaises(ValueError):assets.destination(bad)

    def test_hash_and_image_validation(self):
        data=b'\x89PNG\r\n\x1a\n'+bytes(24)
        with tempfile.TemporaryDirectory() as temp, patch.object(assets,'ROOT',Path(temp)):
            item={'path':'assets/demo/test.png','url':'https://example.invalid/test.png','sha256':hashlib.sha256(data).hexdigest()}
            assets.fetch(item,opener=lambda *a,**k:Response(data))
            target=assets.destination(item['path']);self.assertEqual(target.read_bytes(),data)
            target.write_bytes(b'custom')
            with self.assertRaises(ValueError):assets.fetch(item,opener=lambda *a,**k:Response(data))
            self.assertEqual(target.read_bytes(),b'custom')

    def test_accepts_only_explicitly_reviewed_hash_alternatives(self):
        data=b'\x89PNG\r\n\x1a\n'+bytes(24)
        with tempfile.TemporaryDirectory() as temp, patch.object(assets,'ROOT',Path(temp)):
            item={'path':'assets/demo/test.png','url':'https://example.invalid/test.png','sha256':'0'*64,'alternateSha256':[hashlib.sha256(data).hexdigest()]}
            assets.fetch(item,opener=lambda *a,**k:Response(data))
            self.assertEqual(assets.destination(item['path']).read_bytes(),data)

    def test_rejects_html_and_changed_download_without_final_file(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(assets,'ROOT',Path(temp)):
            item={'path':'assets/demo/test.png','url':'https://example.invalid/test.png','sha256':'0'*64}
            for body in [b'<html>error</html>',b'\x89PNG\r\n\x1a\n'+bytes(24)]:
                with self.assertRaises(ValueError):assets.fetch(item,opener=lambda *a,**k:Response(body))
                self.assertFalse(assets.destination(item['path']).exists())

if __name__=='__main__':unittest.main()
