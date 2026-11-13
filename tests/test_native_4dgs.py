"""Analytical checks for the trained model's 4D -> 3D conditioning."""
import importlib.util
from pathlib import Path
import unittest

import numpy as np

spec = importlib.util.spec_from_file_location('native_export', Path(__file__).parents[1] / 'scripts/export-native-4dgs.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ConditioningTests(unittest.TestCase):
    def test_identity_has_no_invented_motion(self):
        scales = np.array([[0.2, 0.3, 0.4, 0.5]])
        identity = np.array([[1., 0, 0, 0]])
        spatial, variance, velocity = module.condition_gaussians(np.log(scales), identity, identity)
        np.testing.assert_allclose(spatial[0], np.diag(scales[0, :3] ** 2), atol=1e-12)
        np.testing.assert_allclose(variance, [0.25], atol=1e-12)
        np.testing.assert_allclose(velocity, 0, atol=1e-12)

    def test_rotated_time_axis_matches_analytic_conditional_distribution(self):
        theta = 0.37
        c, s = np.cos(theta), np.sin(theta)
        sx, sy, sz, st = 0.2, 0.3, 0.4, 0.8
        spatial, variance, velocity = module.condition_gaussians(
            np.log([[sx, sy, sz, st]]), np.array([[c, s, 0, 0]]), np.array([[1., 0, 0, 0]]),
        )
        expected_variance = s*s*sz*sz + c*c*st*st
        xy = np.array([[c, s], [-s, c]]) @ np.diag([sx*sx, sy*sy]) @ np.array([[c, -s], [s, c]])
        np.testing.assert_allclose(variance[0], expected_variance, atol=1e-12)
        np.testing.assert_allclose(spatial[0, :2, :2], xy, atol=1e-12)
        np.testing.assert_allclose(spatial[0, 2, 2], sz*sz*st*st / expected_variance, atol=1e-12)
        np.testing.assert_allclose(velocity[0], [0, 0, c*s*(st*st-sz*sz) / expected_variance], atol=1e-12)
        self.assertTrue(np.all(np.linalg.eigvalsh(spatial[0]) > 0))


if __name__ == '__main__':
    unittest.main()
