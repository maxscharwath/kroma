//! Signing a device in from another device it cannot talk to directly.
//!
//! Both roads end in the same place (the server holds a pending request until a
//! signed-in account approves it, then hands the waiting device an ordinary
//! session) and both are built on the one store in [`grants`]. They differ in
//! how the human points at the device:
//!
//! - [`handoff`] lists the TVs waiting on the caller's own subnet, so pointing
//!   at one is a tap. The road for a phone and a TV on the same network.
//! - [`quickconnect`] shows four digits on the TV for a human to carry. Slower,
//!   but it works from anywhere, so it stays as the fallback.

mod grants;
pub mod handoff;
pub mod quickconnect;

pub use grants::{Granted, Orphaned, PollState};
pub use handoff::{Handoff, HandoffInner};
pub use quickconnect::{QuickConnect, QuickConnectInner};
