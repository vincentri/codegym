//! Core of CodeGym: shared types, the answer comparator, the built-in question bank and the
//! SQLite store. Nothing here depends on the GUI, so it builds and tests anywhere.

pub mod bank;
pub mod compare;
pub mod store;
pub mod types;

pub use store::{Store, StoreError};
pub use types::*;
