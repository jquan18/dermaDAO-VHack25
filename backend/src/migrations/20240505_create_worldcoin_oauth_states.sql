-- Create worldcoin_oauth_states table
CREATE TABLE IF NOT EXISTS worldcoin_oauth_states (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state VARCHAR(255) NOT NULL UNIQUE,
  nonce VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes'),
  used BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_worldcoin_oauth_states_user_id ON worldcoin_oauth_states(user_id);
CREATE INDEX IF NOT EXISTS idx_worldcoin_oauth_states_state ON worldcoin_oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_worldcoin_oauth_states_expires_at ON worldcoin_oauth_states(expires_at);

-- Add worldcoin related columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS worldcoin_id VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS worldcoin_verification_level VARCHAR(50) NULL; 