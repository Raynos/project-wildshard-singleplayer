"""A later valid source edit must not inherit an earlier model comparison."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import wave

from ob7_build import REPO, read_compared_take, shared_bed


class ComparedTakeTest(unittest.TestCase):
    def test_shared_bed_keeps_the_canonical_file_and_qualified_provenance(self) -> None:
        source = REPO / 'public/assets/sfx/coral-drift/sfx.json'
        data = json.loads(source.read_text())
        original = data['beds']['coral-drift.ambience']
        asset = source.parent / original['file']
        entry, proof, size = shared_bed({'set': 'coral-drift', 'bed': 'coral-drift.ambience', 'gap': 'No rain'})
        self.assertEqual(entry['file'], {'set': 'coral-drift', 'file': asset.name})
        self.assertEqual(entry['loopStart'], original['loopStart'])
        self.assertEqual(entry['loopEnd'], original['loopEnd'])
        self.assertEqual(proof['reuse']['recordingSha256'], hashlib.sha256(asset.read_bytes()).hexdigest())
        self.assertEqual(size, asset.stat().st_size)
        self.assertLessEqual(proof['comparison'][proof['winner']]['rank'], 5)
        with self.assertRaisesRegex(ValueError, 'confined catalogue'):
            shared_bed({'set': '../coral-drift', 'bed': 'coral-drift.ambience', 'gap': 'No rain'})
        with self.assertRaisesRegex(ValueError, 'direct existing recording'):
            shared_bed({'set': 'coral-drift', 'bed': 'missing', 'gap': 'No rain'})

    def test_changed_wave_or_metadata_refuses(self) -> None:
        with tempfile.TemporaryDirectory(dir=REPO / "tmp", prefix="ob7-source-control-") as folder:
            wav = Path(folder) / "701.wav"
            with wave.open(str(wav), "wb") as stream:
                stream.setparams((1, 2, 48000, 0, "NONE", "not compressed"))
                stream.writeframes(b"\x01\x00" * 480)
            side = wav.with_suffix(".json")
            side.write_text(json.dumps({"seed": 701, "model": "MOSS-SoundEffect v2"}))
            original = wav.read_bytes()
            comparison = {"sourceWaveSha256": hashlib.sha256(original).hexdigest(),
                          "sourceMetadataSha256": hashlib.sha256(side.read_bytes()).hexdigest()}
            self.assertEqual(read_compared_take(wav, comparison)["source"]["seed"], 701)
            wav.write_bytes(original[:-2] + b"\x02\x00")
            with self.assertRaisesRegex(ValueError, "source changed"):
                read_compared_take(wav, comparison)
            wav.write_bytes(original)
            side.write_text(json.dumps({"seed": 702, "model": "MOSS-SoundEffect v2"}))
            with self.assertRaisesRegex(ValueError, "source changed"):
                read_compared_take(wav, comparison)


if __name__ == "__main__":
    unittest.main()
