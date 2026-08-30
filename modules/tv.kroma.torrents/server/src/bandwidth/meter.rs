use crate::db::{BandwidthSample, TransferredBytes};

/// How wide a stored window is before the retention ladder folds it.
pub const STEP: i64 = 60;

/// The longest a reading may credit to one interval. A machine that slept, or a
/// module that was disabled for a week, comes back with a huge gap; charging
/// the whole of it to the seal state we happen to observe on return would claim
/// a week of tunnel we never watched.
const MAX_GAP: i64 = 2 * STEP;

/// Whether the bridge was carrying the embedded engine's traffic.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Seal {
    /// No bridge is configured, so traffic is meant to leave directly and
    /// there is nothing to be sealed against.
    Off,
    /// A bridge is configured and the last seal probe reached a different exit.
    Held,
    /// A bridge is configured and the last probe did not confirm it. Traffic
    /// that moved here is not protected, whatever the operator intended.
    Broken,
}

/// Turns the engine's lifetime counters into closed windows of bytes.
///
/// It holds the previous reading and emits a window only when the clock crosses
/// into the next one, so a caller ticking every few seconds writes one row a
/// minute. The FIRST reading of a process seeds the baseline and emits nothing:
/// without that, a restart would charge the whole lifetime total to one window.
#[derive(Debug, Default)]
pub struct Meter {
    last: Option<(i64, TransferredBytes)>,
    open: Option<BandwidthSample>,
}

impl Meter {
    /// Fold one reading in, and hand back the window it closed if it closed
    /// one. `at` is a unix second.
    pub fn read(
        &mut self,
        at: i64,
        counters: TransferredBytes,
        seal: Seal,
    ) -> Option<BandwidthSample> {
        let previous = self.last.replace((at, counters))?;
        let elapsed = (at - previous.0).clamp(0, MAX_GAP);
        let moved = moved_since(previous.1, counters);
        let closed = self.close_if_stale(at);
        if moved == TransferredBytes::default() && seal != Seal::Broken {
            return closed;
        }
        let open = self
            .open
            .get_or_insert_with(|| BandwidthSample {
                at: at.div_euclid(STEP) * STEP,
                step_secs: STEP,
                ..BandwidthSample::default()
            });
        match seal {
            Seal::Held => {
                open.sealed_down_bytes += moved.embedded_down;
                open.sealed_up_bytes += moved.embedded_up;
                open.sealed_secs += elapsed;
            }
            Seal::Broken => {
                open.unsealed_down_bytes += moved.embedded_down;
                open.unsealed_up_bytes += moved.embedded_up;
                open.unsealed_secs += elapsed;
            }
            Seal::Off => {
                open.bypass_down_bytes += moved.embedded_down;
                open.bypass_up_bytes += moved.embedded_up;
            }
        }
        open.bypass_down_bytes += moved.external_down;
        open.bypass_up_bytes += moved.external_up;
        closed
    }

    fn close_if_stale(&mut self, at: i64) -> Option<BandwidthSample> {
        let opened_at = at.div_euclid(STEP) * STEP;
        if self.open.as_ref().is_some_and(|open| open.at != opened_at) {
            return self.open.take();
        }
        None
    }
}

/// The counters can only fall when a row leaves the ledger, which moved no
/// bytes: a component that went backwards contributes nothing rather than
/// wrapping into an enormous positive.
fn moved_since(previous: TransferredBytes, now: TransferredBytes) -> TransferredBytes {
    TransferredBytes {
        embedded_down: now.embedded_down.saturating_sub(previous.embedded_down),
        embedded_up: now.embedded_up.saturating_sub(previous.embedded_up),
        external_down: now.external_down.saturating_sub(previous.external_down),
        external_up: now.external_up.saturating_sub(previous.external_up),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn embedded(down: u64, up: u64) -> TransferredBytes {
        TransferredBytes {
            embedded_down: down,
            embedded_up: up,
            ..TransferredBytes::default()
        }
    }

    #[test]
    fn the_first_reading_of_a_process_only_seeds_the_baseline() {
        let mut meter = Meter::default();

        let closed = meter.read(0, embedded(9_000_000, 0), Seal::Held);

        assert_eq!(closed, None);
    }

    #[test]
    fn a_window_closes_when_the_clock_crosses_into_the_next_one() {
        let mut meter = Meter::default();
        meter.read(0, embedded(0, 0), Seal::Held);
        meter.read(5, embedded(1_000, 200), Seal::Held);

        let closed = meter.read(65, embedded(1_500, 300), Seal::Held).unwrap();

        assert_eq!(closed.at, 0);
        assert_eq!(closed.step_secs, STEP);
        assert_eq!(closed.sealed_down_bytes, 1_000);
        assert_eq!(closed.sealed_up_bytes, 200);
        assert_eq!(closed.sealed_secs, 5);
    }

    #[test]
    fn traffic_on_a_configured_bridge_that_is_not_sealed_is_recorded_apart() {
        let mut meter = Meter::default();
        meter.read(0, embedded(0, 0), Seal::Broken);
        meter.read(30, embedded(4_000, 0), Seal::Broken);

        let closed = meter.read(60, embedded(4_000, 0), Seal::Broken).unwrap();

        assert_eq!(closed.sealed_down_bytes, 0);
        assert_eq!(closed.unsealed_down_bytes, 4_000);
        assert_eq!(closed.unsealed_secs, 30);
    }

    #[test]
    fn a_broken_bridge_is_recorded_even_when_nothing_moved() {
        let mut meter = Meter::default();
        meter.read(0, embedded(0, 0), Seal::Broken);
        meter.read(30, embedded(0, 0), Seal::Broken);

        let closed = meter.read(60, embedded(0, 0), Seal::Broken).unwrap();

        assert_eq!(closed.unsealed_secs, 30);
        assert_eq!(closed.unsealed_down_bytes, 0);
    }

    #[test]
    fn an_idle_engine_with_no_bridge_opens_no_window_at_all() {
        let mut meter = Meter::default();
        meter.read(0, embedded(500, 0), Seal::Off);
        meter.read(30, embedded(500, 0), Seal::Off);

        let closed = meter.read(600, embedded(500, 0), Seal::Off);

        assert_eq!(closed, None);
    }

    #[test]
    fn an_external_engine_never_counts_as_tunnelled_however_sealed_the_bridge_is() {
        let mut meter = Meter::default();
        meter.read(0, TransferredBytes::default(), Seal::Held);
        meter.read(
            30,
            TransferredBytes {
                embedded_down: 100,
                external_down: 900,
                ..TransferredBytes::default()
            },
            Seal::Held,
        );

        let closed = meter
            .read(60, TransferredBytes::default(), Seal::Held)
            .unwrap();

        assert_eq!(closed.sealed_down_bytes, 100);
        assert_eq!(closed.bypass_down_bytes, 900);
    }

    #[test]
    fn a_counter_that_went_backwards_credits_no_traffic() {
        let mut meter = Meter::default();
        meter.read(0, embedded(9_000, 0), Seal::Held);
        meter.read(30, embedded(10, 0), Seal::Held);

        let closed = meter.read(60, embedded(10, 0), Seal::Held);

        assert_eq!(closed, None);
    }

    #[test]
    fn a_long_gap_credits_at_most_two_windows_of_seal_time() {
        let mut meter = Meter::default();
        meter.read(0, embedded(0, 0), Seal::Held);
        meter.read(86_400, embedded(1_000, 0), Seal::Held);

        let closed = meter.read(86_500, embedded(1_000, 0), Seal::Held).unwrap();

        assert_eq!(closed.sealed_secs, MAX_GAP);
        assert_eq!(closed.sealed_down_bytes, 1_000);
    }
}
