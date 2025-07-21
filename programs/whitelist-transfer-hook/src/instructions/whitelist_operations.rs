use anchor_lang::{
    prelude::*, 
    system_program
};

use crate::state::whitelist::Whitelist;

#[derive(Accounts)]
pub struct WhitelistOperations<'info> {
    #[account(
        mut,
        //address = 
    )]
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [b"whitelist".as_ref()],
        bump,
    )]
    pub whitelist: Option<Account<'info, Whitelist>>,
    pub system_program: Program<'info, System>,
}

impl<'info> WhitelistOperations<'info> {
    pub fn add_to_whitelist(&mut self, address: Pubkey) -> Result<()> {
        if !self.whitelist.as_ref().unwrap().address.contains(&address) {
            self.realloc_whitelist()?;
            self.whitelist.as_mut().unwrap().address.push(address);
        }
        Ok(())
    }

    pub fn remove_from_whitelist(&mut self, address: Pubkey) -> Result<()> {
        if let Some(pos) = self.whitelist.as_ref().unwrap().address.iter().position(|&x| x == address) {
            self.whitelist.as_mut().unwrap().address.remove(pos);
        }
        Ok(())
    }

    pub fn realloc_whitelist(&self) -> Result<()> {
        // Get the account info for the whitelist
        let account_info = self.whitelist.as_ref().unwrap().to_account_info();
        let new_account_size = account_info.data_len() + std::mem::size_of::<Whitelist>();

        // Determine additional rent required
        let lamports_required = (Rent::get()?).minimum_balance(new_account_size);
        let additional_rent_to_fund = lamports_required - account_info.lamports();

        // Perform transfer of additional rent
        let cpi_program = self.system_program.to_account_info();
        let cpi_accounts = system_program::Transfer{
            from: self.admin.to_account_info(), 
            to: account_info.clone(),
        };
        let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
        system_program::transfer(cpi_context,additional_rent_to_fund)?;

        // Reallocate the account
        account_info.resize(new_account_size)?;
        msg!("Account Size Updated");

        Ok(())
    }
}