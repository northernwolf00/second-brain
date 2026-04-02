import nacl from 'tweetnacl';
import { Buffer } from 'buffer';

// Simple deterministic key derivation from passphrase + salt
// For production, replace with a native Argon2id binding
function deriveKey(passphrase: string, salt: Uint8Array): Uint8Array {
  const passphraseBytes = Buffer.from(passphrase, 'utf8');
  const key = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    key[i] = passphraseBytes[i % passphraseBytes.length] ^ salt[i % salt.length];
  }
  return key;
}

export function encrypt(plaintext: string, passphrase: string): string {
  const salt = nacl.randomBytes(16);
  const key = deriveKey(passphrase, salt);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const box = nacl.secretbox(Buffer.from(plaintext, 'utf8'), nonce, key);
  const combined = new Uint8Array(salt.length + nonce.length + box.length);
  combined.set(salt, 0);
  combined.set(nonce, salt.length);
  combined.set(box, salt.length + nonce.length);
  return Buffer.from(combined).toString('base64');
}

export function decrypt(ciphertext: string, passphrase: string): string | null {
  try {
    const combined = Buffer.from(ciphertext, 'base64');
    const salt = combined.slice(0, 16);
    const nonce = combined.slice(16, 16 + nacl.secretbox.nonceLength);
    const box = combined.slice(16 + nacl.secretbox.nonceLength);
    const key = deriveKey(passphrase, new Uint8Array(salt));
    const plaintext = nacl.secretbox.open(new Uint8Array(box), new Uint8Array(nonce), key);
    if (!plaintext) return null;
    return Buffer.from(plaintext).toString('utf8');
  } catch {
    return null;
  }
}
