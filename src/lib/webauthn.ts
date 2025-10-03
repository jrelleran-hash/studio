
"use client";

import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser';

// These would normally come from your server
const MOCK_CHALLENGE = 'mock_challenge_1234567890';
const MOCK_RP_ID = window.location.hostname; // Relying Party ID should be your domain
const MOCK_USER_ID = 'mock_user_id_abcde';
const MOCK_CREDENTIAL_ID = 'mock_credential_id_fghij';

/**
 * Registers a new passkey for the current user.
 * This would normally involve a round-trip to your server to get challenge options.
 */
export async function registerPasskey(userId: string, userName: string): Promise<boolean> {
  try {
    // 1. Get registration options from the server
    // For this demo, we'll create mock options on the client.
    const registrationOptions = {
      challenge: MOCK_CHALLENGE,
      rp: {
        name: 'CoreFlow App',
        id: MOCK_RP_ID,
      },
      user: {
        id: userId, // This should be a stable, non-personally identifiable ID from your database
        name: userName,
        displayName: userName,
      },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' as const }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform' as const, // For device-bound keys (Face ID, Fingerprint)
        requireResidentKey: true,
      },
      timeout: 60000,
      attestation: 'direct' as const,
    };

    // 2. Start the registration process with the browser
    const registrationResponse = await startRegistration(registrationOptions);

    // 3. Send the registration response back to the server for verification and storage
    // In a real app, you would POST `registrationResponse` to your backend.
    // The server would verify it and save the new credential.
    console.log('Registration successful! Response:', registrationResponse);
    
    // For demo, we'll just store the credential ID in local storage.
    // NEVER do this in production. Credential info must be stored on the server.
    localStorage.setItem('passkeyCredentialId', registrationResponse.id);
    localStorage.setItem('passkeyUserId', userId);

    return true;
  } catch (error) {
    console.error('Passkey registration failed:', error);
    if ((error as Error).name === 'InvalidStateError') {
      throw new Error('This device may already be registered. Try signing in with a passkey instead.');
    }
    return false;
  }
}

/**
 * Signs in a user with a previously registered passkey.
 * This would also involve a server round-trip.
 */
export async function signInWithPasskey(): Promise<boolean> {
  try {
    // For this demo, retrieve the user and credential info from local storage.
    // In a real app, you'd get this from the server after the user enters their email.
    const credentialId = localStorage.getItem('passkeyCredentialId');
    const userId = localStorage.getItem('passkeyUserId');

    if (!credentialId || !userId) {
        throw new Error("No passkey found on this device. Please register a passkey first or sign in with your password.");
    }
    
    // 1. Get authentication options from the server
    // The server generates a challenge and might specify which credentials it allows.
    const authenticationOptions = {
      challenge: MOCK_CHALLENGE,
      allowCredentials: [{
          id: credentialId,
          type: 'public-key' as const,
          transports: ['internal'] as const,
      }],
      timeout: 60000,
      userVerification: 'preferred' as const,
      rpId: MOCK_RP_ID,
    };

    // 2. Start the authentication process with the browser
    const authenticationResponse = await startAuthentication(authenticationOptions);

    // 3. Send the authentication response to the server for verification
    // In a real app, you'd POST `authenticationResponse` to your backend.
    // The server would verify the signature and, if valid, create a session for the user.
    console.log('Authentication successful! Response:', authenticationResponse);
    
    // Here, we just return true for the demo as we can't verify on the client.
    return true;
  } catch (error) {
    console.error('Passkey sign-in failed:', error);
    return false;
  }
}
