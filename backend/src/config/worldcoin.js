const worldcoinConfig = {
  clientId: process.env.WLD_CLIENT_ID || '',
  clientSecret: process.env.WLD_CLIENT_SECRET || '',
  redirectUri: process.env.WLD_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/worldcoin',
  wellKnownUrl: 'https://id.worldcoin.org/.well-known/openid-configuration',
  tokenUrl: 'https://id.worldcoin.org/token',
  userInfoUrl: 'https://id.worldcoin.org/userinfo',
  authorizationUrl: 'https://id.worldcoin.org/authorize',
  scope: 'openid',
  
  // Function to create the authorization URL for the frontend
  getAuthorizationUrl: function(state, nonce) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scope,
      state: state,
      nonce: nonce
    });
    
    return `${this.authorizationUrl}?${params.toString()}`;
  }
};

module.exports = worldcoinConfig; 