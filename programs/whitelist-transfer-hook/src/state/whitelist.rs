use anchor_lang::prelude::*;

#[account]
pub struct Whitelist {
    pub user: Pubkey,
    pub bump: u8,
    pub is_whitelisted: bool,
}