use anchor_lang::prelude::*;
use anchor_spl::{
    token_interface::{
        Mint, 
        TokenInterface,
    },
    token_2022::{
        spl_token_2022::{
            extension::{
                transfer_hook::TransferHook as TransferHookExtension,
                ExtensionType,
            },
        },
    },
};
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta,
    state::ExtraAccountMetaList,
};
use spl_transfer_hook_interface::instruction::ExecuteInstruction;

#[derive(Accounts)]
pub struct InitializeMintWithHook<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    /// The mint account with transfer hook extension
    #[account(
        init,
        payer = payer,
        mint::decimals = 9,
        mint::authority = payer,
        extensions::transfer_hook::authority = payer,
        extensions::transfer_hook::program_id = crate::ID,
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    
    /// CHECK: ExtraAccountMetaList Account, will be initialized
    #[account(
        init,
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump,
        space = ExtraAccountMetaList::size_of(
            InitializeMintWithHook::get_extra_account_metas()?.len()
        )?,
        payer = payer
    )]
    pub extra_account_meta_list: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> InitializeMintWithHook<'info> {
    pub fn initialize_mint_with_hook(&mut self) -> Result<()> {
        msg!("Initializing mint with transfer hook...");
        
        // Get the extra account metas for the transfer hook
        let extra_account_metas = Self::get_extra_account_metas()?;
        msg!("Extra Account Metas: {:?}", extra_account_metas);
        msg!("Extra Account Metas Length: {}", extra_account_metas.len());
        
        // Initialize ExtraAccountMetaList account with extra accounts
        ExtraAccountMetaList::init::<ExecuteInstruction>(
            &mut self.extra_account_meta_list.try_borrow_mut_data()?,
            &extra_account_metas
        )?;
        
        msg!("Mint initialized successfully with transfer hook");
        msg!("Mint address: {}", self.mint.key());
        
        Ok(())
    }
    
    fn get_extra_account_metas() -> Result<Vec<ExtraAccountMeta>> {
        use spl_tlv_account_resolution::seeds::Seed;
        
        Ok(
            vec![
                // The whitelist PDA per user, dynamically resolved based on owner
                ExtraAccountMeta::new_with_seeds(
                    &[
                        Seed::Literal {
                            bytes: b"whitelist".to_vec(),
                        },
                        Seed::AccountKey { index: 3 }, // index 3 is the owner account
                    ],
                    false, // is_signer
                    false  // is_writable
                )?
            ]
        )
    }
}
