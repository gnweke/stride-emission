use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer, MintTo},
};

declare_id!("2TadYr2dGaUV7Wi2uFZn1J6eF1Kdju9zpUzoWdTedrhw");

#[program]
pub mod stride_emission {
    use super::*;

    // ----------------- Global init & config -----------------

    pub fn initialize_emission_state(
        ctx: Context<InitializeEmissionState>,
        cap: u64,
        base_rate_per_day: u64,
        annual_decay_bps: u16,
        throttle_target_per_user_micros: u64,
        clamp_min_bps: u16,
        clamp_max_bps: u16,
    ) -> Result<()> {
        let st = &mut ctx.accounts.state;
        st.cap = cap;
        st.emitted = 0;
        st.base_rate_per_day = base_rate_per_day;
        st.annual_decay_bps = annual_decay_bps;
        st.throttle_target_per_user_micros = throttle_target_per_user_micros;
        st.clamp_min_bps = clamp_min_bps;
        st.clamp_max_bps = clamp_max_bps;
        st.last_epoch = 0;
        st.mint = ctx.accounts.mint.key();

        // compute the PDA bump once and store
        let (_pda, bump) =
            Pubkey::find_program_address(&[b"emission_state"], ctx.program_id);
        st.bump = bump;
        Ok(())
    }

    pub fn configure_emission_state(
        ctx: Context<ConfigureEmissionState>,
        cap: u64,
        base_rate_per_day: u64,
        annual_decay_bps: u16,
        throttle_target_per_user_micros: u64,
        clamp_min_bps: u16,
        clamp_max_bps: u16,
    ) -> Result<()> {
        let st = &mut ctx.accounts.state;
        st.cap = cap;
        st.base_rate_per_day = base_rate_per_day;
        st.annual_decay_bps = annual_decay_bps;
        st.throttle_target_per_user_micros = throttle_target_per_user_micros;
        st.clamp_min_bps = clamp_min_bps;
        st.clamp_max_bps = clamp_max_bps;
        Ok(())
    }

    // ----------------- Per-user init -----------------

    pub fn stake_device_init(ctx: Context<StakeDeviceInit>) -> Result<()> {
        let user = &mut ctx.accounts.user;
        user.owner = ctx.accounts.payer.key();
        user.device_count = user.device_count.saturating_add(1);
        user.created_at = Clock::get()?.unix_timestamp;
        let (_addr, bump) = Pubkey::find_program_address(
            &[b"user", ctx.accounts.payer.key.as_ref()],
            ctx.program_id,
        );
        user.bump = bump;
        Ok(())
    }

    // ----------------- Stake (transfer into vault) -----------------

    pub fn stake_device(ctx: Context<StakeDevice>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        // Consistency checks
        require_keys_eq!(
            ctx.accounts.user.owner,
            ctx.accounts.payer.key(),
            ErrorCode::OwnerMismatch
        );
        require_keys_eq!(
            ctx.accounts.user_ata.owner,
            ctx.accounts.payer.key(),
            ErrorCode::OwnerMismatch
        );
        require_keys_eq!(
            ctx.accounts.user_ata.mint,
            ctx.accounts.mint.key(),
            ErrorCode::MintMismatch
        );
        require_keys_eq!(
            ctx.accounts.vault_ata.mint,
            ctx.accounts.mint.key(),
            ErrorCode::MintMismatch
        );

        // Transfer from user to vault_ata (payer signs)
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_ata.to_account_info(),
            to: ctx.accounts.vault_ata.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        };
        let cpi_ctx =
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }

    // ----------------- Unstake (transfer back to user) -----------------

    pub fn unstake_device(ctx: Context<UnstakeDevice>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        // Basic consistency checks
        require_keys_eq!(
            ctx.accounts.user.owner,
            ctx.accounts.payer.key(),
            ErrorCode::OwnerMismatch
        );
        require_keys_eq!(
            ctx.accounts.user_ata.owner,
            ctx.accounts.payer.key(),
            ErrorCode::OwnerMismatch
        );
        require_keys_eq!(
            ctx.accounts.user_ata.mint,
            ctx.accounts.mint.key(),
            ErrorCode::MintMismatch
        );
        require_keys_eq!(
            ctx.accounts.vault_ata.mint,
            ctx.accounts.mint.key(),
            ErrorCode::MintMismatch
        );

        // Keep pubkey alive while borrowing its bytes for seeds
        let user_key = ctx.accounts.user.key();
        let seeds: &[&[u8]] = &[b"vault", user_key.as_ref(), &[ctx.bumps.vault_authority]];
        let signer = &[seeds];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_ata.to_account_info(),
            to: ctx.accounts.user_ata.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }

    // ----------------- Claim Rewards (mint to user) -----------------

    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        // TEST-FRIENDLY EPOCH GATE:
        // Use state.last_epoch so local tests can advance epochs via update_epoch
        require!(
            ctx.accounts.state.last_epoch > ctx.accounts.user.last_claim_epoch,
            ErrorCode::AlreadyClaimedToday
        );

        // Compute daily amount in base units (micros -> base)
        let target_micros =
            ctx.accounts.state.throttle_target_per_user_micros as u128;
        let mut amount: u64 =
            (target_micros / 1_000_000u128).min(u128::from(u64::MAX)) as u64;

        // Cap by remaining supply
        let remaining =
            ctx.accounts.state.cap.saturating_sub(ctx.accounts.state.emitted);
        amount = amount.min(remaining);
        require!(amount > 0, ErrorCode::EmissionExhausted);

        // Mint to user using state PDA as signer
        let signer_seeds: &[&[u8]] =
            &[b"emission_state", &[ctx.accounts.state.bump]];
        let signer = &[signer_seeds];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.user_ata.to_account_info(),
            authority: ctx.accounts.state.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        token::mint_to(cpi_ctx, amount)?;

        // Bookkeeping
        ctx.accounts.state.emitted =
            ctx.accounts.state.emitted.saturating_add(amount);
        ctx.accounts.user.last_claim_epoch = ctx.accounts.state.last_epoch;

        Ok(())
    }

    // ----------------- Update Epoch (manual dev tick) -----------------
    //
    // Localnet-friendly: each call advances last_epoch by 1 so you can
    // claim once per tick without waiting for a real UTC day.
    // Swap this back to the time-based version when moving to prod.
    pub fn update_epoch(ctx: Context<UpdateEpoch>) -> Result<()> {
        ctx.accounts.state.last_epoch =
            ctx.accounts.state.last_epoch.saturating_add(1);
        Ok(())
    }
}

// ================= Global State =================

#[account]
pub struct EmissionState {
    pub cap: u64,
    pub emitted: u64,
    pub base_rate_per_day: u64,
    pub annual_decay_bps: u16,
    pub throttle_target_per_user_micros: u64,
    pub clamp_min_bps: u16,
    pub clamp_max_bps: u16,
    pub last_epoch: u64,
    pub mint: Pubkey,
    pub bump: u8,
}
// size = 8 (discriminator) + fields(87)
pub const EMISSION_STATE_SIZE: usize = 8 + 87;

#[derive(Accounts)]
pub struct InitializeEmissionState<'info> {
    #[account(
        init,
        payer = payer,
        seeds = [b"emission_state"],
        bump,
        space = EMISSION_STATE_SIZE
    )]
    pub state: Account<'info, EmissionState>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConfigureEmissionState<'info> {
    #[account(
        mut,
        seeds = [b"emission_state"],
        bump = state.bump
    )]
    pub state: Account<'info, EmissionState>,
    pub payer: Signer<'info>,
}

// ================= Per-user State =================

#[account]
pub struct UserAccount {
    pub owner: Pubkey,         // 32
    pub device_count: u16,     // 2
    pub created_at: i64,       // 8
    pub bump: u8,              // 1
    pub last_claim_epoch: u64, // 8
}
// size = 8 + 59
pub const USER_ACCOUNT_SIZE: usize = 8 + 59;

#[derive(Accounts)]
pub struct StakeDeviceInit<'info> {
    #[account(
        init,
        payer = payer,
        seeds = [b"user", payer.key().as_ref()],
        bump,
        space = USER_ACCOUNT_SIZE
    )]
    pub user: Account<'info, UserAccount>,

    #[account(
        seeds = [b"emission_state"],
        bump = state.bump
    )]
    pub state: Account<'info, EmissionState>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StakeDevice<'info> {
    #[account(
        mut,
        seeds = [b"user", payer.key().as_ref()],
        bump = user.bump
    )]
    pub user: Account<'info, UserAccount>,

    #[account(
        seeds = [b"emission_state"],
        bump = state.bump
    )]
    pub state: Account<'info, EmissionState>,

    pub mint: Account<'info, Mint>,

    /// CHECK: PDA authority for the vault ATA
    #[account(
        seeds = [b"vault", user.key().as_ref()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    // Client creates this ATA idempotently; program only requires it be correct.
    #[account(
        mut,
        constraint = vault_ata.mint == mint.key() @ ErrorCode::MintMismatch,
        // SPL TokenAccount::owner is the token owner (not the close authority).
        constraint = vault_ata.owner == vault_authority.key() @ ErrorCode::OwnerMismatch
    )]
    pub vault_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_ata.owner == payer.key() @ ErrorCode::OwnerMismatch,
        constraint = user_ata.mint == mint.key() @ ErrorCode::MintMismatch
    )]
    pub user_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnstakeDevice<'info> {
    #[account(
        mut,
        seeds = [b"user", payer.key().as_ref()],
        bump = user.bump
    )]
    pub user: Account<'info, UserAccount>,

    pub mint: Account<'info, Mint>,

    /// CHECK: PDA authority for the vault ATA
    #[account(
        seeds = [b"vault", user.key().as_ref()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = vault_ata.mint == mint.key() @ ErrorCode::MintMismatch,
        constraint = vault_ata.owner == vault_authority.key() @ ErrorCode::OwnerMismatch
    )]
    pub vault_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_ata.owner == payer.key() @ ErrorCode::OwnerMismatch,
        constraint = user_ata.mint == mint.key() @ ErrorCode::MintMismatch
    )]
    pub user_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(
        mut,
        seeds = [b"user", payer.key().as_ref()],
        bump = user.bump
    )]
    pub user: Account<'info, UserAccount>,

    #[account(
        mut,
        seeds = [b"emission_state"],
        bump = state.bump
    )]
    pub state: Account<'info, EmissionState>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = user_ata.owner == payer.key() @ ErrorCode::OwnerMismatch,
        constraint = user_ata.mint == mint.key() @ ErrorCode::MintMismatch
    )]
    pub user_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateEpoch<'info> {
    #[account(
        mut,
        seeds = [b"emission_state"],
        bump = state.bump
    )]
    pub state: Account<'info, EmissionState>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Owner mismatch")]
    OwnerMismatch,
    #[msg("Mint mismatch")]
    MintMismatch,
    #[msg("Already claimed in this epoch")]
    AlreadyClaimedToday,
    #[msg("Emission exhausted")]
    EmissionExhausted,
}
