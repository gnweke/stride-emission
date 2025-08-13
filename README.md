# Stride Emission Program

A Solana Anchor program for **staking, unstaking, and reward emissions** with per-user throttling, epoch-based claiming, and configurable emission parameters.

---

## 🚀 Features

- **Staking & Unstaking**: Move tokens into and out of a program vault.
- **Configurable Emission State**:
  - Cap total supply
  - Base rate per day
  - Annual decay
  - Throttle target per user
  - Min/Max clamp rates
- **Epoch-based Reward Claiming**:
  - One claim per epoch (day)
  - Emission supply cap enforcement
- **Per-User State Tracking**:
  - Device count
  - Last claim epoch
  - Created at timestamp

---

## 📦 Project Structure

```
stride-emission/
├── programs/
│   └── stride-emission/   # Anchor program code (lib.rs)
├── scripts/               # Client-side scripts to interact with program
├── tests/                 # Anchor Mocha tests
├── migrations/            # Anchor deploy scripts
└── test-ledger/           # Local test ledger data
```

---

## 🛠 Setup

### Prerequisites
- [Rust](https://www.rust-lang.org/tools/install)
- [Anchor CLI](https://www.anchor-lang.com/docs/installation)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- Node.js & npm (or yarn)

### Install Dependencies
```bash
npm install
```

---

## ⚙️ Usage

### 1️⃣ Build the program
```bash
anchor build
```

### 2️⃣ Start a local Solana validator
```bash
solana-test-validator
```

### 3️⃣ Deploy program locally
```bash
anchor deploy
```

### 4️⃣ Run scripts
Example: Initialize emission state
```bash
npx ts-node scripts/init.ts
```

Stake tokens:
```bash
npx ts-node scripts/stake_with_transfer.ts
```

Claim rewards:
```bash
npx ts-node scripts/claim.ts
```

---

## 📜 Key Instructions

| Instruction                  | Description                                   |
|------------------------------|-----------------------------------------------|
| `initialize_emission_state`  | Sets up global emission parameters            |
| `configure_emission_state`   | Updates emission settings                     |
| `stake_device_init`          | Initializes user staking account              |
| `stake_device`               | Transfers tokens into the vault               |
| `unstake_device`             | Transfers tokens back to the user             |
| `claim_rewards`              | Mints rewards for the current epoch           |

---

## 🧪 Testing

Run the Anchor tests:
```bash
anchor test
```

---

## 🌍 Deployment

To deploy on devnet:
```bash
solana config set --url devnet
anchor deploy
```

---

## 📄 License
MIT License © 2025 Will Nweke

---

## 📈 Progress

| Date       | Update |
|------------|--------|
| 2025-08-13 | Initial working version of program & scripts committed to GitHub |
| 2025-08-13 | Added README with setup, usage, and progress tracking |
| YYYY-MM-DD | _Add more entries as you make updates_ |

---

## 🤝 Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.
