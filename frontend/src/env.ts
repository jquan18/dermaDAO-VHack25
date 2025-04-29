// Environment configuration for API endpoints
export const API_CONFIG = {
  // The base URL for backend API requests
  BACKEND_API_URL: process.env.NEXT_PUBLIC_BACKEND_API_URL || '/api',
  
  // Use this URL for direct API calls in serverless functions
  SERVERLESS_API_URL: 'https://derma-dao-junquan2.vercel.app/api'
};
