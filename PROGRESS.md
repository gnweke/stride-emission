# Project Progress — Stride Emission

This document tracks the detailed development history of the **Stride Emission** Solana Anchor program and scripts, plus the latest verified state from localnet testing.  
It serves as a transparent log for collaborators, grant reviewers, and community members.

---

## 2025-08-13 — Initial Commit & Setup
- Completed development of the **stride-emission** Solana Anchor program.
- Implemented core functionality:
  - Emission state initialization & configuration.
  - Stake and unstake device functions with PDA-based vault authority.
  - Reward claim mechanism with epoch-based restrictions.
  - Epoch tick updater for reward gating.
- Created supporting scripts for:
  - Program initialization (`init.ts`)
  - Emission state configuration (`configure.ts`)
  - Epoch ticking (`epoch_tick.ts`)
  - Staking & unstaking (`stake_init.ts`, `stake_with_transfer.ts`, `unstake.ts`)
  - Claiming rewards (`claim.ts`)
  - Reading program state & user info (`read_state.ts`, `read_user.ts`, `read_balances.ts`)
- Added `.gitignore` and cleaned repository structure.
- Successfully tested:
  - Program initialization.
  - Staking flow.
  - Reward claim with epoch progression.
  - Error handling for claiming twice in the same epoch.

---

## 2025-08-14 — GitHub Integration & Documentation
- Initialized local Git repository and connected it to GitHub.
- Resolved interactive rebase hang and pushed initial commit to `main` branch.
- Created detailed `README.md` with:
  - Project description
  - Setup instructions
  - Script usage guide
  - Basic progress table
- Established `PROGRESS.md` for full changelog tracking.

---

## 2025-08-14 — Localnet Verified State

### ✅ What’s working
- **Program deploys** and **PDAs derive** as expected.
- **Initialize/Configure** works (re-run of `init.ts` fails with “already in use” as expected).
- **Stake flow** correctly transfers tokens into vault ATA.
- **Unstake flow** returns tokens from vault ATA to user ATA.
- **Claim rewards** works and is **epoch-gated** by `state.last_epoch`.
- **Epoch tick** script advances `last_epoch` to allow the next claim.
- **Read scripts** for state, user, and balances all functioning.

### Key Addresses (this run)
- Program ID: `2TadYr2dGaUV7Wi2uFZn1J6eF1Kdju9zpUzoWdTedrhw`
- State PDA: `3sYbvhedE9S1QFQpfui2fxKiYudn99CvnPUgEWxYqm27`
- Mint: `Fcrke8UhayYM1MwDufituXELiFfnNPUjmk9Q7Bt4pPZF`
- User pubkey: `Gkd9dqJkB72Foxvcb17GUYaxb79pyrvJYoT7nJ7ZRq3P`
- UserAccount PDA: `9pHThTwdE26mNJFRWLdypewqBgSpog5bX39Dgjzx8NwS`
- Vault authority PDA: `9WsnMUX1kPyb6vXhrDvZLmvM83yGTXurAK4eYwbzimHc`
- Vault ATA: `3iF5h31bPobgfXQE1CxRMtkvCahe466UY6LsYLtanib8`
- User ATA: `6LsFS35krujPdwpCq4FcipJrqgbLBkicDzm5TMp827dx`

_All ATAs verified via `getAssociatedTokenAddressSync` and PDA derivation rules._

