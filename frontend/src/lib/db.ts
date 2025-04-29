// Mock database client for API routes
// This is used as a placeholder for routes that expect a database
// In a production environment, you would use a real database client

interface Project {
  id: number;
  name: string;
  description: string;
  target_amount: number;
  current_amount: number;
  wallet_address: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

interface Transaction {
  id: number;
  transaction_hash: string;
  from_address: string;
  to_address: string;
  amount: number;
  status: string;
  created_at: Date;
}

// Mock database implementation
export const db = {
  project: {
    findUnique: async ({ where }: { where: { id: number } }) => {
      // Return a mock project for demo purposes
      return {
        id: where.id,
        name: `Project ${where.id}`,
        description: 'This is a mock project for demo purposes',
        target_amount: 10000,
        current_amount: 5000,
        wallet_address: '0x123abc123abc123abc123abc123abc123abc123a',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };
    },
    findMany: async () => {
      // Return mock projects for demo purposes
      return [
        {
          id: 1,
          name: 'Project 1',
          description: 'This is a mock project for demo purposes',
          target_amount: 10000,
          current_amount: 5000,
          wallet_address: '0x123abc123abc123abc123abc123abc123abc123a',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 2,
          name: 'Project 2',
          description: 'Another mock project for demo purposes',
          target_amount: 20000,
          current_amount: 15000,
          wallet_address: '0x456def456def456def456def456def456def456d',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];
    }
  },
  transaction: {
    findMany: async ({ where }: { where: any }) => {
      // Return mock transactions for demo purposes
      return [
        {
          id: 1,
          transaction_hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          from_address: '0x789ghi789ghi789ghi789ghi789ghi789ghi789g',
          to_address: '0x123abc123abc123abc123abc123abc123abc123a',
          amount: 1000,
          status: 'completed',
          created_at: new Date(Date.now() - 86400000) // 1 day ago
        },
        {
          id: 2,
          transaction_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          from_address: '0x789ghi789ghi789ghi789ghi789ghi789ghi789g',
          to_address: '0x123abc123abc123abc123abc123abc123abc123a',
          amount: 2000,
          status: 'completed',
          created_at: new Date(Date.now() - 172800000) // 2 days ago
        }
      ];
    }
  }
};
