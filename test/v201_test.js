import { describe, expect, test } from "bun:test";
import { SqliteAdapter } from "../lib/database.js";
import { messageCache } from "../lib/message_cache.js";
import { ApiRequestError } from "../lib/api_client.js";
import path from "path";
import fs from "fs";

describe("Database SqliteAdapter", () => {
    const testDbPath = path.join(process.cwd(), "db", "test_database.sqlite");

    test("init, write, read, dan close data", async () => {
        if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

        const adapter = new SqliteAdapter(testDbPath);
        await adapter.init();

        const payload = {
            users: { "628123456@s.whatsapp.net": { limit: 10, exp: 100 } },
            chats: { "123456@g.us": { isMuted: false } }
        };

        const writeOk = await adapter.write(payload);
        expect(writeOk).toBe(true);

        const readData = await adapter.read();
        expect(readData.users["628123456@s.whatsapp.net"].limit).toBe(10);
        expect(readData.chats["123456@g.us"].isMuted).toBe(false);

        await adapter.close();
        if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    });
});

describe("MessageCache SQLite", () => {
    test("save, get, dan clean pesan", () => {
        const dummyMsg = {
            key: { id: "TEST_MSG_001", remoteJid: "123@s.whatsapp.net" },
            message: { conversation: "halo test" }
        };

        messageCache.save(dummyMsg);
        const retrieved = messageCache.get("TEST_MSG_001");
        expect(retrieved).not.toBeNull();
        expect(retrieved.key.id).toBe("TEST_MSG_001");
        expect(retrieved.message.conversation).toBe("halo test");

        const notFound = messageCache.get("NON_EXISTENT_ID");
        expect(notFound).toBeNull();
    });
});

describe("Universal API Client Error Handling", () => {
    test("ApiRequestError proper name, status, and apiName mapping", () => {
        const err = new ApiRequestError("Limit kuota habis", 401, "zans", "/api/test");
        expect(err.name).toBe("ApiRequestError");
        expect(err.statusCode).toBe(401);
        expect(err.apiName).toBe("zans");
        expect(err.message).toBe("Limit kuota habis");
        expect(err.endpoint).toBe("/api/test");
    });

    test("global.API builds multi-api URL properly", () => {
        global.APIs.dummy = "https://api.example.com";
        global.APIKeys["https://api.example.com"] = "secret123";

        const builtUrl = global.API("dummy", "/v1/search", { q: "test" });
        expect(builtUrl).toContain("https://api.example.com/v1/search");
        expect(builtUrl).toContain("q=test");
        expect(builtUrl).toContain("apikey=secret123");
    });
});

describe("Message Serializer (smsg) and LID Quoted Handling", () => {
    test("smsg normalizes sender, lid mapping and builds m.reply with correct target", async () => {
        const { smsg } = await import("../lib/simple.js");

        let sentJid = null;
        let sentContent = null;
        let sentOpts = null;
        const fakeClient = {
            sendMessage: async (jid, content, opts) => {
                sentJid = jid;
                sentContent = content;
                sentOpts = opts;
                return { id: "MSG_REPLY_123" };
            }
        };

        const incomingEvent = {
            key: {
                remoteJid: "32393079611419@lid",
                remoteJidAlt: "6285157336614@s.whatsapp.net",
                id: "INCOMING_MSG_1",
                fromMe: false
            },
            message: { conversation: ".menu" },
            pushName: "Tester"
        };

        const m = await smsg(fakeClient, incomingEvent);
        expect(m.chat).toBe("32393079611419@lid");
        expect(m.sender).toBe("6285157336614@s.whatsapp.net");

        await m.reply("Daftar Menu");
        expect(sentJid).toBe("32393079611419@lid");
        expect(sentContent.text).toBe("Daftar Menu");
        expect(sentOpts.quoted.key.id).toBe("INCOMING_MSG_1");
    });
});
