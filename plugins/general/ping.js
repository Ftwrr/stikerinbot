const handler = async (msg, { reply }) => {
    const start = Date.now();
    await reply(`🏓 Pong!\n⏱️ Kecepatan respons: *${Date.now() - start}ms*`);
};

handler.command = ['ping', 'p'];
handler.category = 'General';
handler.desc = 'Cek kecepatan respon bot';
export default handler;
