pub const GROUP_SEED: &[u8] = b"group";
pub const VAULT_SEED: &[u8] = b"vault";
pub const MEMBER_SEED: &[u8] = b"member";

/// Upper bound on members per group; also sizes `Group::members`.
pub const MAX_MEMBERS: u8 = 20;
pub const MIN_MEMBERS: u8 = 2;

/// Short minimum so the flow can be demoed and tested; the UI defaults to weekly.
pub const MIN_PERIOD_SECS: i64 = 10;
pub const MAX_PERIOD_SECS: i64 = 90 * 24 * 60 * 60;
