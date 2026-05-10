import { Elysia, t } from "elysia";
import type { StringOutputFormat } from "libsodium-wrappers";
const VAULT_TOKEN = process.env.VAULT_TOKEN || await Bun.file("/vault/secrets/token").text();
export const tokenChecker = async (bearerToken: string): Promise<boolean> => {
  try {
    const token = bearerToken.replace("Bearer ", "");
    const base64Data = token.split(".")[0];
    const vaultToken = token.split(".")[1];

    const response = await fetch(
      "http://192.168.1.102:8200/v1/sso/verify/login/sha3-512",
      {
        method: "POST",
        headers: {
          "X-Vault-Token": VAULT_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: base64Data,
          signature: vaultToken,
        }),
      }
    );
    const data: vaultValidateResponse =
      (await response.json()) as vaultValidateResponse;
    if (data.errors && data.errors.length > 0) {
      return false;
    }
    return data.data.valid;
    // return await response.json();
  } catch (error) {
    console.error("Vault error:", error);
    throw new Error("Failed to get JWT from Vault");
  }
};
export interface vaultValidateResponse {
  request_id: string;
  lease_id: string;
  renewable: boolean;
  lease_duration: number;
  data: {
    valid: boolean;
  };
  mount_type: string;
  errors: Array<string>;
}
