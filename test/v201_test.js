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

    test("m.sendButtons builds interactiveMessage native flow", async () => {
        const { smsg } = await import("../lib/simple.js");

        let sentContent = null;
        const fakeClient = {
            sendMessage: async (jid, content) => {
                sentContent = content;
                return { id: "BTN_1" };
            }
        };

        const m = await smsg(fakeClient, {
            key: { remoteJid: "6285157336614@s.whatsapp.net", id: "IN_2", fromMe: false },
            message: { conversation: ".menu" }
        });

        await m.sendButtons("Pilih menu", [{ id: ".menu all", text: "Semua" }], "Footer");
        expect(sentContent.interactiveMessage.body.text).toBe("Pilih menu");
        expect(sentContent.interactiveMessage.footer.text).toBe("Footer");

        const btn = sentContent.interactiveMessage.nativeFlowMessage.buttons[0];
        expect(btn.name).toBe("quick_reply");
        expect(JSON.parse(btn.buttonParamsJson).id).toBe(".menu all");
    });

    test("readRichReply extracts native flow response id", async () => {
        const { readRichReply } = await import("../lib/rich_message.js");
        const reply = readRichReply({
            interactiveResponseMessage: {
                nativeFlowResponseMessage: { name: "quick_reply", paramsJson: JSON.stringify({ id: ".claim" }) }
            }
        });
        expect(reply.id).toBe(".claim");
    });
});

describe("Group Utils", () => {
    test("numFromJid & findParticipant resolve LID vs phone", async () => {
        const { numFromJid, findParticipant, isAdminParticipant } = await import("../lib/group_utils.js");

        expect(numFromJid("628123456789:12@s.whatsapp.net")).toBe("628123456789");
        expect(numFromJid("22914321629255@lid")).toBe("22914321629255");

        const meta = {
            participants: [
                { jid: "111@lid", lid: "111@lid", phoneNumber: "628999888777@s.whatsapp.net", isAdmin: true },
                { jid: "628111222333@s.whatsapp.net", isAdmin: false }
            ]
        };

        const admin = findParticipant(meta, "628999888777@s.whatsapp.net");
        expect(admin.jid).toBe("111@lid");
        expect(isAdminParticipant(admin)).toBe(true);

        const member = findParticipant(meta, "628111222333@s.whatsapp.net");
        expect(isAdminParticipant(member)).toBe(false);
    });

    test("resolveTarget prioritizes mention then reply then phone", async () => {
        const { resolveTarget } = await import("../lib/group_utils.js");

        expect(resolveTarget({ mentionedJid: ["6281@s.whatsapp.net"] }, "")).toBe("6281@s.whatsapp.net");
        expect(resolveTarget({ quoted: { sender: "6282@s.whatsapp.net" } }, "")).toBe("6282@s.whatsapp.net");
        expect(resolveTarget({}, "08123456789")).toBe("628123456789@s.whatsapp.net");
    });
});

describe("Rich Handler Registry", () => {
    test("onRichReply / getRichHandler roundtrip", async () => {
        const { onRichReply, getRichHandler, offRichReply } = await import("../lib/rich_handler.js");

        const fn = async () => true;
        onRichReply("ww:test:1", fn);
        expect(getRichHandler("ww:test:1")).toBe(fn);

        offRichReply("ww:test:1");
        expect(getRichHandler("ww:test:1")).toBeUndefined();
    });
});

describe("Werewolf Engine", () => {
    test("computeRoleList scales roles with player count", async () => {
        const { computeRoleList } = await import("../lib/werewolf.js");

        const five = computeRoleList(5);
        expect(five.length).toBe(5);
        expect(five.filter(r => r === "werewolf").length).toBe(1);
        expect(five).toContain("seer");

        const eight = computeRoleList(8);
        expect(eight.length).toBe(8);
        expect(eight.filter(r => r === "werewolf").length).toBe(2);
        expect(eight).toContain("sorcerer");
    });
});

describe("Group Access & Anti-Link", () => {
    const meta = {
        subject: "Grup Tes",
        desc: "deskripsi",
        owner: "628999888777@s.whatsapp.net",
        announce: false,
        participants: [
            { jid: "111@lid", lid: "111@lid", phoneNumber: "628999888777@s.whatsapp.net", isAdmin: true },
            { jid: "628111222333@s.whatsapp.net", isAdmin: false },
            { jid: "999@lid", lid: "999@lid", phoneNumber: "628555666777@s.whatsapp.net", isAdmin: false }
        ]
    };

    const fakeClient = () => ({
        user: { id: "628999888777:5@s.whatsapp.net" },
        group: { queryGroupMetadata: async () => meta },
        sent: [],
        sendMessage(jid, content) { this.sent.push({ jid, content }); return { id: "X" }; }
    });

    test("resolveGroupAccess detects admin sender & bot admin", async () => {
        const { resolveGroupAccess, invalidateGroupCache } = await import("../lib/group_utils.js");
        invalidateGroupCache();

        const client = fakeClient();
        const access = await resolveGroupAccess(client, {
            chat: "123@g.us",
            sender: "628111222333@s.whatsapp.net",
            senderNumber: "628111222333",
            realPhone: "628111222333"
        });
        expect(access.isAdmin).toBe(false);
        expect(access.isBotAdmin).toBe(true);

        const adminAccess = await resolveGroupAccess(client, {
            chat: "123@g.us",
            sender: "628555666777@s.whatsapp.net",
            realPhone: "628555666777"
        });
        expect(adminAccess.isAdmin).toBe(false);
    });

    test("anti-link watcher deletes link from non-admin, skips admin", async () => {
        const { invalidateGroupCache } = await import("../lib/group_utils.js");
        invalidateGroupCache();

        global.db = global.db || { data: {}, scheduleSave() {} };
        global.db.data = global.db.data || {};
        global.db.data.chats = { "123@g.us": { antiLink: true } };

        const watcher = (await import("../plugins/group/antilink_watcher.js")).default;
        const client = fakeClient();
        const replies = [];
        const reply = async (t) => replies.push(t);

        // Non-admin kirim link → dihapus + true
        const handled = await watcher({
            isGroup: true,
            chat: "123@g.us",
            sender: "628555666777@s.whatsapp.net",
            senderNumber: "628555666777",
            realPhone: "628555666777",
            cleanText: "cek https://example.com",
            key: { id: "MSG1", participant: "628555666777@s.whatsapp.net" },
            isOwner: false
        }, { client, reply });

        expect(handled).toBe(true);
        expect(client.sent[0].content.delete.id).toBe("MSG1");
        expect(replies.length).toBe(1);

        // Admin kirim link → diabaikan
        const handledAdmin = await watcher({
            isGroup: true,
            chat: "123@g.us",
            sender: "628999888777@s.whatsapp.net",
            realPhone: "628999888777",
            cleanText: "cek https://example.com",
            key: { id: "MSG2" },
            isOwner: false
        }, { client, reply });

        expect(handledAdmin).toBe(false);
    });
});
