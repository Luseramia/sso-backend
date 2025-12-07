import { Elysia, t } from "elysia";
import { redis } from "./redis";
const { randomBytes, createPublicKey, verify, createCipheriv } = await import(
  "node:crypto"
);
import sodium from "libsodium-wrappers";
// import sodium from "libsodium-wrappers-sumo";

import { Buffer } from "node:buffer";
await sodium.ready;

export const ssoController = new Elysia().group("/sso", (app) =>
  app
    .post(
      "/register-uuid",
      async (c) => {
        console.log(c.body);
        const { uuid, algorithm, publicKey } = c.body;
        // const publicKeyDer = Buffer.from(c.body.publicKey, "base64");
        const challenge = randomBytes(256).toString("base64");

        await redis.set(
          `auth:pending:${uuid}`,
          JSON.stringify({
            uuid,
            publicKey,
            challenge,
            algorithm,
            status: "pending",
            requestedAt: new Date(),
          }),
          "EX",
          60
        );

        return { challenge };
      },
      {
        body: t.Object({
          uuid: t.String(),
          publicKey: t.String(),
          algorithm: t.String(),
        }),
      }
    )
    .post(
      "/verify-device",
      async (c) => {
        const { uuid, challenge, signature } = c.body;
        const data = await redis.get(`auth:pending:${uuid}`);
        if (!data) {
          c.set.status = 404;
          return { error: "Request not found or expired" };
        }
        const authData = JSON.parse(data);
        if (authData.challenge !== challenge) {
          c.set.status = 400;
          return { error: "Invalid challenge" };
        }
        const isValid = verifySignature(
          challenge,
          signature,
          authData.publicKey,
          authData.algorithm
        );

        if (!isValid) {
          c.set.status = 400;
          return { error: "Invalid signature" };
        }

        authData.status = "verified";
        authData.verifiedAt = new Date().toISOString();

        await redis.setex(`auth:pending:${uuid}`, 60, JSON.stringify(authData));
      },
      {
        body: t.Object({
          uuid: t.String(),
          challenge: t.String(),
          signature: t.String(),
        }),
      }
    )
    .post(
      "/poll-jwt",
      async (c) => {
        const { uuid, challenge } = c.body;
        try {
          const data = await redis.get(`auth:signed:${uuid}`);
          if (!data) {
            c.set.status = 404;
            return { error: "Request expired" };
          }

          const authData = JSON.parse(data);

          // ตรวจสอบ challenge
          if (authData.challenge !== challenge) {
            c.set.status = 400;
            return { error: "Invalid challenge" };
          }

          if (authData.status === "approved" && authData.encryptedToken) {
            // ลบออกจาก Redis (one-time use)
            await redis.del(`auth:pending:${uuid}`);
            return {
              status: "approved",
              encryptedToken: authData.encryptedToken,
            };
          } else if (authData.status === "rejected") {
            await redis.del(`auth:pending:${uuid}`);
            c.set.status = 200;
            return { status: "rejected" };
          } else {
            // ยังรอ approval
            return { status: authData.status };
          }
        } catch (error) {
          console.error("Polling error:", error);
          c.set.status = 500;
          return { error: "Polling failed" };
        }
      },
      {
        body: t.Object({
          uuid: t.String(),
          challenge: t.String(),
        }),
      }
    )
    .post(
      "/approve-uuid",
      async (c) => {
        const { uuid } = c.body;
        console.log("uuid", uuid);

        const data = await redis.get(`auth:pending:${uuid}`);
        if (!data) {
          c.set.status = 404;
          return { error: "Request not found" };
        }

        const authData = JSON.parse(data);
        if (authData.status !== "verified") {
          c.set.status = 400;
          return { error: "Device not verified" };
        }
        const dataBase64 = Buffer.from(data).toString("base64");
        const jwt = (await requestJWTFromVault(dataBase64)) as any;
        console.log("dataBase64", dataBase64 + "." + jwt["data"]["signature"]);

        const encryptedToken = await encryptJWT(
          dataBase64 + "." + jwt["data"]["signature"],
          authData.publicKey,
          authData.algorithm
        );

        authData.status = "approved";
        authData.encryptedToken = encryptedToken;
        authData.approvedAt = new Date().toISOString();
        await redis.del(`auth:pending:${uuid}`);
        await redis.setex(`auth:signed:${uuid}`, 60, JSON.stringify(authData));

        return { success: true };
      },
      {
        body: t.Object({
          uuid: t.String(),
        }),
      }
    )
    .post(
      "/reject-uuid",
      async (c) => {
        const { uuid } = c.body;
        const data = await redis.get(`auth:pending:${uuid}`);
        if (!data) {
          c.set.status = 404;
          return { error: "Request not found" };
        }

        const authData = JSON.parse(data);
        if (authData.status !== "verified") {
          c.set.status = 400;
          return { error: "Device not verified" };
        }

        authData.status = "rejected";
        authData.rejectedAt = new Date().toISOString();

        await redis.setex(`auth:pending:${uuid}`, 10, JSON.stringify(authData));

        return { success: true };
      },
      {
        body: t.Object({
          uuid: t.String(),
        }),
      }
    )
    .get("/pending-uuids", async (c) => {
      const keys = await redis.keys("*");

      const result = await Promise.all(
        keys.map(async (key) => {
          const ttl = await redis.ttl(key);

          // ตัด prefix ออก
          const uuid = key.replace("auth:pending:", "");

          return { uuid, ttl };
        })
      );
      return result;
    })
);

function verifySignature(
  message: string,
  signatureBase64: string,
  publicKeyBase64: string,
  algorithm: string
) {
  const messageBuffer = Buffer.from(message, "utf8");
  const signatureBuffer = Buffer.from(signatureBase64, "base64");
  const publicKeyRaw = Buffer.from(publicKeyBase64, "base64");

  try {
    if (algorithm === "ed25519") {
      const publicKey = createPublicKey({
        key: Buffer.concat([
          Buffer.from([
            0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21,
            0x00,
          ]),
          publicKeyRaw,
        ]),
        format: "der",
        type: "spki",
      });

      return verify(null, messageBuffer, publicKey, signatureBuffer);
    }
    return false;
  } catch (error) {
    console.error("Signature verification failed:", error);
    return false;
  }
}

async function requestJWTFromVault(dataBase64: string) {
  try {
    const response = await fetch(
      "http://192.168.1.102:8200/v1/sso/sign/login/sha3-512",
      {
        method: "POST",
        headers: {
          "X-Vault-Token":"",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: dataBase64,
        }),
      }
    );

    return await response.json();
  } catch (error) {
    console.error("Vault error:", error);
    throw new Error("Failed to get JWT from Vault");
  }
}

// Helper: Encrypt JWT (ใช้ Public Key ของ Device)

async function encryptJWT(
  jwt: string,
  publicKeyBase64: string,
  algorithm: string
) {
  try {
    await sodium.ready;
    console.log("✓ Sodium initialized");

    console.log("Input publicKeyBase64:", publicKeyBase64);

    // Decode and sanitize public key
    let edPublicKey = new Uint8Array(Buffer.from(publicKeyBase64, "base64"));
    console.log("Decoded bytes length:", edPublicKey.length);

    if (edPublicKey.length === 33) {
      console.log("Removing prefix byte...");
      edPublicKey = edPublicKey.slice(1);
    } else if (edPublicKey.length > 32) {
      console.log("Extracting last 32 bytes...");
      edPublicKey = edPublicKey.slice(-32);
    } else if (edPublicKey.length < 32) {
      throw new Error(`Invalid key length: ${edPublicKey.length}`);
    }

    // Convert Ed25519 → X25519
    const x25519PublicKey =
      sodium.crypto_sign_ed25519_pk_to_curve25519(edPublicKey);
    console.log("✓ X25519 conversion successful");

    // ✅ แก้ไข: ใช้ crypto_box_keypair (ถูกต้อง)
    const ephKeyPair = sodium.crypto_box_keypair();
    console.log("✓ Generated ephemeral keypair");

    // ✅ แก้ไข: ใช้ crypto_box_easy (authenticated encryption)
    const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
    const jwtBytes = new Uint8Array(Buffer.from(jwt, "utf8"));

    const ciphertext = sodium.crypto_box_easy(
      jwtBytes,
      nonce,
      x25519PublicKey,
      ephKeyPair.privateKey
    );

    console.log("✓ Encryption successful");

    return {
      ciphertext: Buffer.from(ciphertext).toString("base64"),
      ephemeralPublicKey: Buffer.from(ephKeyPair.publicKey).toString("base64"),
      nonce: Buffer.from(nonce).toString("base64"),
    };
  } catch (error) {
    console.error("Encryption error:", error);
    throw error;
  }
}
