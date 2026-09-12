"""python3 test_make_demos.py — checks every baked demo has a valid clip header and length."""
import json, os, tempfile, unittest
import make_demos
from gbsim import encode_clip, Frame

BYTES = 17 * 9 * 3


class T(unittest.TestCase):
    def test_encode_clip_header_and_length(self):
        data = encode_clip([Frame(), Frame()], fps=12)
        self.assertEqual(list(data[:4]), [0x43, 12, 2, 0])
        self.assertEqual(len(data), 4 + 2 * BYTES)

    def test_bake_all_demos(self):
        with tempfile.TemporaryDirectory() as d:
            make_demos.OUT = d
            make_demos.main()
            manifest = json.load(open(os.path.join(d, "demos.json")))
            self.assertEqual([m["slug"] for m in manifest], [s for s, *_ in make_demos.all_demos()])
            for m in manifest:
                data = open(os.path.join(d, f"{m['slug']}.bin"), "rb").read()
                self.assertEqual(data[0], 0x43)
                self.assertEqual(data[1], m["fps"])
                self.assertEqual(data[2] | (data[3] << 8), m["frames"])
                self.assertEqual(len(data), 4 + m["frames"] * BYTES)
                self.assertTrue(1 <= m["frames"] <= 900)


if __name__ == "__main__":
    unittest.main()
