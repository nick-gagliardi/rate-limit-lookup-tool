// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react'; // Import the provider
import RateLimitSearch from './RateLimitSearch'; 
import './index.css';

// --- Auth0 Configuration ---
// REPLACE THESE WITH YOUR ACTUAL VALUES
// It is best practice to load these from a .env file (e.g., VITE_AUTH0_DOMAIN)
const domain = "dev-1-2s2aq0.us.auth0.com"; 
const clientId = "cELselAfetIRDGr4himvk7NVrTQtKs5N"; // Get this from your Auth0 Application Settings
const audience = "http://localhost:3001"; // This must match your API server's Audience/Identifier

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin, // Where Auth0 redirects after login (usually your app's root)
        audience: audience, // IMPORTANT: Requests the token for your specific backend API
        scope: "openid profile email" // Standard scopes
      }}
    >
      <RateLimitSearch />
    </Auth0Provider>
  </React.StrictMode>,
);