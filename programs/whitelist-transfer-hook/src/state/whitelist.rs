use anchor_lang::prelude::*;

#[account]
pub struct Whitelist {
    pub address: Vec<Pubkey>,
}