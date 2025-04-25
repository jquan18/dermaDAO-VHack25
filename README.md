# DermaDAO

**Blockchain-Powered Charitable Giving Platform**

---

## 🌟 VHack USM 2025 Hackathon

- **Event:** VHack USM 2025  
- **Team:** DermaDAO Team  

---

## 📖 Project Overview

DermaDAO is a revolutionary blockchain-based philanthropic platform that reduces the trust deficit in global giving. Built on the Scroll Layer-2 network and leveraging ERC-4337 account abstraction, DermaDAO delivers a seamless Web2-like experience while maintaining blockchain’s transparency and security.

Key innovations:
- **ERC-4337 Account Abstraction:** Smart contract wallets, gasless transactions, session keys  
- **Corporate-Themed Quadratic Funding:** Custom funding rounds with on-chain matching, zero fees  
- **Multi-Layer Verification:** AI + human evaluators + on-chain record for fraud-resistant vetting  
- **Milestone-Based Releases:** Direct bank transfers upon proof of project milestones  
- **Worldcoin Integration:** Optional Sybil-resistance for quadratic funding


---

## 🚀 Features

- Web2-style signup (email/password) with on-chain wallet provisioning  
- Gasless and batched donations covered by sponsors  
- Theme-specific funding rounds with transparent matching algorithm  
- Live impact tracking: proofs, scores, and bank transfers  
- Corporate dashboard with Iridescence animated background for fund management and CSR reporting  
- Cross-border fiat on/off ramps (Transak)  

---

## 🛠️ Tech Stack

| Layer           | Tools & Services                                             |
|-----------------|--------------------------------------------------------------|
| Frontend        | React, Next.js, TypeScript, Tailwind CSS, cobe, motion, ogl  |
| Smart Contracts | Solidity, Hardhat, Scroll L2                                 |
| Backend         | Node.js, Express.js, PostgreSQL, Sequelize, ethers.js       |
| Infra & CI/CD   | AWS/Heroku, Docker (optional), GitHub Actions               |
| Integrations    | Transak API, Worldcoin SDK                      |

---

## 📥 Getting Started

### Prerequisites

- Node.js v16+  
- npm or yarn  
- PostgreSQL  
- API keys: `COINBASE_API_KEY`, `WISE_API_KEY`, `WORLDCOIN_API_KEY`  

### Installation

```bash
# Clone the repo
git clone https://github.com/jquan18/dermaDAO-erc4337-multipool.git
cd dermadao-erc4337-multipool

# Backend setup
cd backend
cp .env.example .env
npm install
# initialize DB
npm run migrate
npm run dev

# Frontend setup
cd ../frontend
npm install
npm run dev
```

### Usage

- Open your browser at `http://localhost:9000`  
- Sign up, fund your wallet, and explore themed funding rounds  
- For corporate sponsors, log in and visit `/dashboard/corporate`  

---

## 🏗️ Architecture

```
Frontend (Next.js + Iridescence UI)
   ↕
Smart Contracts (ERC-4337 wallets, funding pools)
   ↕
Backend API (Express.js)
   ↕
PostgreSQL
```

- **Scroll L2:** Low gas, high throughput  
- **ERC-4337:** Account abstraction for UX simplicity  
- **Quadratic `Matching`:** Solidity-based formula  
- **Fiat Payouts:** Wise integration for bank transfers  

---

## 🗂️ Project Deliverables

See detailed spec and milestones in  
`.cursor/rules/project-deliverables.mdc`.

---

## 🤝 Contributing

Contributions are welcome! Please open issues or PRs.

---

## 📜 License

This project is licensed under the MIT License.

---

