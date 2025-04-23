-- Add Onfido verification fields to users table
ALTER TABLE users 
ADD COLUMN is_onfido_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN onfido_applicant_id VARCHAR(255) NULL,
ADD COLUMN onfido_check_id VARCHAR(255) NULL,
ADD COLUMN onfido_verification_status VARCHAR(50) NULL,
ADD COLUMN onfido_verified_at TIMESTAMP WITH TIME ZONE; 