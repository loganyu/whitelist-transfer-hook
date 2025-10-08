use anchor_lang::{
    prelude::*, 
};

use crate::state::whitelist::Whitelist;

#[derive(Accounts)]
#[instruction(user: Pubkey)]
pub struct AddToWhitelist<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 1 + 1, // discriminator + pubkey + bool + bump
        seeds = [b"whitelist", user.as_ref()],
        bump
    )]
    pub whitelist: Account<'info, Whitelist>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(user: Pubkey)]
pub struct RemoveFromWhitelist<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        close = admin,
        seeds = [b"whitelist", user.as_ref()],
        bump = whitelist.bump,
    )]
    pub whitelist: Account<'info, Whitelist>,
    
    pub system_program: Program<'info, System>,
}

impl<'info> AddToWhitelist<'info> {
    pub fn add_to_whitelist(&mut self, user: Pubkey, bumps: &AddToWhitelistBumps) -> Result<()> {
        self.whitelist.set_inner(Whitelist {
            user,
            is_whitelisted: true,
            bump: bumps.whitelist,
        });
        msg!("User {} added to whitelist", user);
        Ok(())
    }
}

impl<'info> RemoveFromWhitelist<'info> {
    pub fn remove_from_whitelist(&mut self) -> Result<()> {
        msg!("User {} removed from whitelist", self.whitelist.user);
        Ok(())
    }
}
