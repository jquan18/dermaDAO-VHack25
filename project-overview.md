# Refined DermaDAO Project Overview

## Project Summary

DermaDAO is a revolutionary blockchain-based charitable giving platform that addresses the critical trust deficit in philanthropy through cutting-edge innovations: corporate-sponsored themed quadratic funding rounds, scoring-based project verification, project-specific smart contract wallets, and milestone-based fund release with direct bank transfers. Built on Scroll blockchain with advanced account abstraction, DermaDAO delivers a seamless user experience that combines traditional web simplicity with blockchain transparency.

## Core Technical Innovations

### 1. ERC-4337 Account Abstraction

DermaDAO implements the ERC-4337 account abstraction standard to create a familiar web2-like experience while leveraging blockchain benefits:

**Technical Implementation:**

- **Smart Contract Wallets**: Each user receives a programmable smart contract wallet upon signup
- **No Private Keys**: Users authenticate with email/password, eliminating seed phrases and crypto complexity
- **Gasless Transactions**: Platform or sponsors cover gas fees for charitable donations
- **Bundled Transactions**: Batched execution reduces costs and improves efficiency
- **Session Keys**: Allow secure, limited-duration permissions without full wallet access

**Benefits:**

- Users experience traditional web simplicity with blockchain security
- No need to understand gas fees, transactions, or blockchain concepts
- Enhanced security with programmable spending limits and controls
- Complete elimination of technical barriers to blockchain adoption

### 2. Corporate-Sponsored Themed Quadratic Funding Rounds

DermaDAO enables corporations to create customized, themed funding rounds with native Scroll blockchain integration:

**Technical Implementation:**

- **Corporate Funding Round Creation**: Companies can establish multiple themed funding rounds (e.g., "Environmental Sustainability," "Medical Research," "Education")
- **Theme-Specific Smart Contracts**: Each funding round operates on a dedicated smart contract with theme parameters
- **Corporate Dashboard**: Interface for sponsors to set funding parameters, duration, and eligibility criteria
- **Direct ETH Donations**: 100% of user donations go directly to project-specific wallets
- **Themed Funding Pool Contracts**: Corporate sponsors contribute to dedicated pools aligned with their ESG goals
- **Quadratic Matching Algorithm**: Smart contracts calculate funding based on the formula: Matching = (Number of contributors × √Average contribution)²
- **Worldcoin Integration**: Optional verification for quadratic funding participation to prevent Sybil attacks

**Benefits:**

- Corporations can align charitable giving with brand values and ESG objectives
- Multiple simultaneous themed rounds increase platform engagement
- Companies gain transparent impact metrics for corporate social responsibility reporting
- 100% of direct donations reach projects (zero fees)
- Democratic resource allocation based on community support
- Amplified impact for projects with broad grassroots backing
- Sybil-resistance ensures fair distribution of matching funds

### 3. Three-Layer Verification System

DermaDAO implements a robust triple verification system for all project proposals:

**Technical Implementation:**

- **Theme Compatibility Check**: Initial screening ensures project alignment with funding round themes
- **AI Evaluation Contract**: Automated system screens for fraud indicators and pattern matches against known scams
- **Human Evaluator Interface**: Standardized scoring forms based on established criteria
- **Combined Score Calculation**: Weighted average determines approval with clear threshold requirements
- **On-chain Verification Record**: Immutable transparency for all verification decisions

**Benefits:**

- Ensures projects align with corporate sponsor themes and objectives
- Data-driven approach eliminates subjective decision-making
- Multiple independent evaluations reduce bias
- Standardized criteria ensure consistent evaluation
- Complete transparency in the approval process

### 4. Milestone-Based Fund Release with Direct Bank Transfers

DermaDAO ensures proper fund utilization through a structured implementation process:

**Technical Implementation:**

- **Proposal Smart Contract**: Manages withdrawal requests with milestone evidence
- **AI Verification System**: Validates milestone completion and proposal legitimacy
- **Crypto-to-Fiat Bridge**: Integration with Coinbase for seamless ETH-to-fiat conversion
- **International Banking Integration**: Wise (TransferWise) API for direct transfers to pre-verified bank accounts
- **Destination Verification**: Funds go directly to implementation partners' bank accounts, not to the charity itself

**Benefits:**

- Eliminates risk of fund misappropriation
- Creates complete transparency from donation to implementation
- Enables real-world impact verification
- Bridges the crypto-traditional finance gap seamlessly

## Technical Architecture

### Scroll Blockchain Implementation

DermaDAO leverages Scroll's Ethereum Layer 2 solution for optimal performance:

- **Low Gas Costs**: Dramatically reduced transaction fees compared to Ethereum mainnet
- **Ethereum Compatibility**: Full compatibility with Ethereum tooling and standards
- **Scalability**: High throughput capacity for handling donation volume
- **Carbon Efficiency**: Lower environmental impact compared to other blockchain options

### Financial Infrastructure Integration

DermaDAO's seamless on/off-ramp system:

- **Wallet Funding**: Users fund their wallet through Coinbase integration
- **Direct Donations**: ETH transfers between user and project wallets
- **Fiat Conversion**: Coinbase API for crypto-to-fiat conversion
- **International Transfers**: Wise API for global banking transfers
- **Audit Trail**: Complete transaction history from donation to bank deposit

## User Experience

### Simplified Donor Journey

1. **Web2-Style Signup**:
    
    - Register with email and password like any traditional website
    - No blockchain knowledge or crypto wallet required
    - Behind the scenes: Smart contract wallet created and linked to email
2. **Easy Wallet Funding**:
    
    - Fund wallet directly with credit card or bank transfer
    - Behind the scenes: Fiat converted to ETH and deposited in user's smart contract wallet
    - No crypto exchanges or wallet management needed
3. **Themed Donation Experience**:
    
    - Browse active funding rounds by theme (Environmental, Medical, Education, etc.)
    - View verified projects within each themed round with transparency metrics
    - Donate with single click, no gas fees or transaction complexity
    - Behind the scenes: ETH transferred directly to project wallet
    - Optional: Verify with Worldcoin for quadratic funding participation
4. **Impact Tracking**:
    
    - Monitor project milestones completion in real-time
    - View proof of implementation and bank transfers
    - Access transparent verification scores and funding utilization

### Charity Organization Journey

1. **Initial Verification**:
    
    - Traditional KYC process for charity organizations
    - Documentation submission for verification scoring
    - Upon approval: Access to platform functionality
2. **Project Submission**:
    
    - Submit detailed project proposals for specific themed funding rounds
    - Demonstrate alignment with corporate sponsor themes
    - Undergo triple verification scoring (AI + 2 humans)
    - Upon approval: Receive dedicated project wallet
3. **Implementation & Verification**:
    
    - Complete milestone deliverables according to plan
    - Submit evidence and withdrawal proposal for verification
    - Specify pre-verified implementation bank accounts
    - Upon approval: Automatic fund transfer to specified bank accounts

### Corporate Sponsor Journey

1. **Sponsor Account Setup**:
    
    - Complete corporate verification and KYC
    - Link company ESG objectives to platform themes
    - Fund corporate wallet with initial sponsorship amount
2. **Themed Funding Round Creation**:
    
    - Define round theme (e.g., "Climate Action," "Healthcare Access")
    - Set funding parameters (total amount, duration, matching formula adjustments)
    - Establish eligibility criteria for participating charities
    - Deploy themed funding pool smart contract
3. **Impact Monitoring**:
    
    - Track real-time fund distribution across approved projects
    - Access detailed impact metrics and ROI on charitable giving
    - Generate transparent CSR reports with blockchain-verified data
    - Receive recognition for sponsorship with customizable visibility options

By combining ERC-4337 account abstraction, corporate-sponsored themed quadratic funding rounds, Scroll blockchain efficiency, and direct banking integration, DermaDAO represents a comprehensive solution to transform philanthropy from a trust-based to a transparency-based model, potentially unlocking billions in additional charitable giving.