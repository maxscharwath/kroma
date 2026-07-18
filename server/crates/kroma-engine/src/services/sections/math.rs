//! Small vector helpers shared by the embedding-based section code: the vector
//! cache's nearest-neighbour search ([`super::cache`]) and the taste clusterer
//! ([`super::taste`]). Both operate on pre-normalized embedding vectors.

/// Dot product of two equal-length vectors. On pre-normalized vectors this is the
/// cosine similarity.
pub(super) fn dot(a: &[f32], b: &[f32]) -> f32 {
    a.iter().zip(b).map(|(x, y)| x * y).sum()
}

/// Scale `v` to unit length in place. A no-op on the zero vector.
pub(super) fn normalize(v: &mut [f32]) {
    let norm = v.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for x in v.iter_mut() {
            *x /= norm;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dot_is_sum_of_products() {
        assert_eq!(dot(&[1.0, 2.0, 3.0], &[4.0, 5.0, 6.0]), 32.0);
        assert_eq!(dot(&[], &[]), 0.0);
        // Orthogonal unit vectors -> 0 similarity.
        assert_eq!(dot(&[1.0, 0.0], &[0.0, 1.0]), 0.0);
    }

    #[test]
    fn normalize_scales_to_unit_length() {
        let mut v = [3.0f32, 4.0];
        normalize(&mut v);
        let len = (v[0] * v[0] + v[1] * v[1]).sqrt();
        assert!((len - 1.0).abs() < 1e-6, "expected unit length, got {len}");
        assert!((v[0] - 0.6).abs() < 1e-6);
        assert!((v[1] - 0.8).abs() < 1e-6);
        // A normalized vector dotted with itself is ~1 (cosine of 0deg).
        assert!((dot(&v, &v) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn normalize_zero_vector_is_noop() {
        let mut z = [0.0f32, 0.0, 0.0];
        normalize(&mut z);
        assert_eq!(z, [0.0, 0.0, 0.0]);
    }
}
