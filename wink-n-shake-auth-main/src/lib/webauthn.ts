// Triggers a platform biometric prompt (Face ID, Touch ID, Android fingerprint)
// via WebAuthn. We don't store the credential — the act of completing
// `userVerification: required` is the proof of biometric.
export async function biometricVerify(label: string): Promise<{ method: string }> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    throw new Error("WebAuthn is not supported on this device");
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Sentinel MFA" },
      user: {
        id: userId,
        name: label,
        displayName: label,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "discouraged",
      },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error("Biometric verification cancelled");
  return { method: "platform-biometric" };
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}
