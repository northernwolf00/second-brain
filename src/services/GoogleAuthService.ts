import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Store } from '../store/mmkv';

WebBrowser.maybeCompleteAuthSession();

// Replace with your Google OAuth client ID from console.cloud.google.com
// Create an OAuth 2.0 client → type: iOS/Android → add your app bundle ID
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export interface GoogleUser {
  email: string;
  name: string;
  accessToken: string;
}

export const GoogleAuthService = {
  useGoogleAuth() {
    const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });
    const [request, response, promptAsync] = AuthSession.useAuthRequest(
      {
        clientId: GOOGLE_CLIENT_ID,
        scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.file'],
        redirectUri,
        responseType: AuthSession.ResponseType.Token,
      },
      discovery,
    );
    return { request, response, promptAsync };
  },

  async fetchUserInfo(accessToken: string): Promise<GoogleUser> {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    return { email: data.email, name: data.name, accessToken };
  },

  async signOut(): Promise<void> {
    await Store.clearGoogleUser();
  },
};
