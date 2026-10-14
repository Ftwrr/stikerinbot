/**
 * Werewolf Game Plugin
 * Engine: lib/werewolf.js
 */

import {
  MIN_PLAYERS, MAX_PLAYERS, TEAM, ROLE_INFO,
  getGame, createGame, joinGame, leaveGame, startGame, stopGame, resendRole
} from '../../lib/werewolf.js';

const HELP =
  '🐺 ✦ ━━ *WEREWOLF* ━━ ✦ 🐺\n\n' +
  '*.ww start* — buka lobby baru (kamu jadi host)\n' +
  '*.ww join* — gabung lobby\n' +
  '*.ww leave* — keluar lobby\n' +
  '*.ww players* — daftar pemain\n' +
  '*.ww begin* — (host) mulai game\n' +
  '*.ww stop* — (host) bubarin game\n' +
  '*.ww roles* — penjelasan semua role & kubu\n' +
  '*.ww myrole* — kirim ulang role kamu lewat DM\n\n' +
  `Minimal ${MIN_PLAYERS} pemain, maksimal ${MAX_PLAYERS}.\n` +
  'Aksi malam lewat *tombol di DM bot*, sidang siang lewat *tombol di grup*.';

function rolesText() {
  const section = (team) =>
    Object.values(ROLE_INFO)
      .filter((r) => r.team === team)
      .map((r) => `${r.emoji} *${r.name}*\n${r.desc}`)
      .join('\n\n');

  return (
    '📖 ✦ ━━ *DAFTAR ROLE* ━━ ✦ 📖\n\n' +
    `${TEAM.warga.emoji} *${TEAM.warga.name}*\n_${TEAM.warga.goal}_\n\n${section('warga')}\n\n` +
    '━━━━━━━━━━━━━━━━━━\n\n' +
    `${TEAM.wolf.emoji} *${TEAM.wolf.name}*\n_${TEAM.wolf.goal}_\n\n${section('wolf')}\n\n` +
    '_Penyihir baru muncul mulai 6 pemain. Peramal melihat Penyihir sebagai warga biasa._'
  );
}

function playerName(m) {
  return m.pushName || m.senderNumber || String(m.sender).split('@')[0].split(':')[0];
}

function listPlayers(game) {
  return [...game.players.values()].map((p, i) => `${i + 1}. ${p.name}${p.jid === game.hostJid ? ' 👑' : ''}`).join('\n');
}

const handler = async (m, { client, from, text, args, command, reply }) => {
  if (!m.isGroup) {
    return reply('🐺 Werewolf cuma bisa dimainin di *grup*.');
  }

  const sub = (args[0] || 'help').toLowerCase();
  const game = getGame(m.chat, client);

  // Cek apakah bot adalah Admin grup sebelum mengizinkan game Werewolf
  if (['start', 'begin'].includes(sub)) {
    try {
      if (client?.group?.queryGroupMetadata) {
        const meta = await client.group.queryGroupMetadata(m.chat);
        const botJidRaw = client.user?.id || client.auth?.credentials?.pnJid || client.auth?.credentials?.meJid || '';
        const botNum = botJidRaw.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');

        const botPart = meta.participants.find(p => {
          const pJid = p.jid || '';
          const pLid = p.lid || '';
          const pPhone = (p.phoneNumber || '').replace(/[^0-9]/g, '');
          const pNum = pJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
          const pLidNum = pLid ? pLid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') : '';
          return (botNum && (pNum === botNum || pPhone === botNum || pLidNum === botNum)) || pJid === botJidRaw;
        });

        const isBotAdmin = Boolean(botPart?.isAdmin || botPart?.isSuperAdmin || botPart?.type === 'admin' || botPart?.type === 'superadmin');

        if (!isBotAdmin) {
          const noAdminMsg = '⛔ *BOT HARUS MENJADI ADMIN GRUP!*\n\nUntuk bermain game Werewolf, bot wajib dijadikan *Admin grup* terlebih dahulu agar bot dapat mengatur giliran malam/siang serta mengawasi pemain yang gugur.';
          const buttons = [
            { text: '📖 Info Werewolf', id: '.ww' }
          ];
          if (m.sendButtons) {
            return await m.sendButtons(noAdminMsg, buttons, 'Werewolf • Perlu Admin');
          }
          return reply(noAdminMsg);
        }
      }
    } catch (_) {}
  }

  switch (sub) {
    case 'start': {
      if (game) return reply('Udah ada game/lobby di grup ini. *.ww join* buat gabung atau *.ww stop* (host) buat bubarin.');
      const g = createGame(m.chat, m.sender, playerName(m), client);
      const textLobby = `🌑 ✦ ━━ *LOBBY DESA KELAM* ━━ ✦ 🌑\n\n` +
        `_Kabut mulai turun. Siapa yang berani memasuki desa itu?_\n\n` +
        `👑 Host: ${playerName(m)}\n` +
        `Tekan tombol *Gabung* buat ikutan (min ${MIN_PLAYERS} pemain).\n` +
        `Kalo udah cukup, host bisa mulai game.\n\n` +
        `Pemain (${g.players.size}/${MIN_PLAYERS}):\n${listPlayers(g)}`;

      const buttons = [
        { text: '🕯️ Gabung (.ww join)', id: '.ww join' },
        ...(g.players.size >= MIN_PLAYERS ? [{ text: '⚔️ Mulai (.ww begin)', id: '.ww begin' }] : []),
        { text: '📜 Roles (.ww roles)', id: '.ww roles' }
      ];

      if (m.sendButtons) {
        return await m.sendButtons(textLobby, buttons, 'Werewolf • Lobby');
      }
      return reply(textLobby);
    }

    case 'join': {
      if (!game) return reply('Belum ada lobby. Ketik *.ww start* dulu.');
      const err = joinGame(game, m.sender, playerName(m));
      if (err) return reply(err);
      if (m.react) await m.react('✅');

      const isReady = game.players.size >= MIN_PLAYERS;
      const readyNotice = isReady ? `\n\n✅ *Pemain sudah mencukupi (${game.players.size} pemain)!* Host (@${String(game.hostJid).split('@')[0]}) silakan tekan Mulai Game.` : '';
      const textJoin = `🕯️ *${playerName(m)}* melangkah masuk ke desa...\n\nPemain (${game.players.size}/${MIN_PLAYERS}):\n${listPlayers(game)}${readyNotice}`;

      const buttons = [
        { text: '🕯️ Gabung (.ww join)', id: '.ww join' },
        ...(isReady ? [{ text: '⚔️ Mulai (.ww begin)', id: '.ww begin' }] : []),
        { text: '👣 Keluar (.ww leave)', id: '.ww leave' }
      ];

      if (m.sendButtons) {
        return await m.sendButtons(textJoin, buttons, 'Werewolf • Lobby');
      }
      return reply(textJoin);
    }

    case 'leave': {
      if (!game) return reply('Belum ada lobby.');
      const err = leaveGame(game, m.sender);
      if (err) return reply(err);

      const textLeave = `👣 *${playerName(m)}* kabur meninggalkan desa.\n\nPemain (${game.players.size}/${MIN_PLAYERS}):\n${listPlayers(game)}`;
      const buttons = [
        { text: '🕯️ Gabung (.ww join)', id: '.ww join' },
        ...(game.players.size >= MIN_PLAYERS ? [{ text: '⚔️ Mulai (.ww begin)', id: '.ww begin' }] : [])
      ];
      if (m.sendButtons) {
        return await m.sendButtons(textLeave, buttons, 'Werewolf • Lobby');
      }
      return reply(textLeave);
    }

    case 'players':
    case 'list': {
      if (!game) return reply('Belum ada game di grup ini.');
      const rows = [...game.players.values()]
        .map((p, i) => `${i + 1}. ${p.name}${game.phase === 'running' ? (p.alive ? ' 🟢' : ' 💀') : ''}`)
        .join('\n');
      const textPlayers = `🐺 *Pemain (${game.players.size})* — fase: ${game.phase}\n\n${rows}`;
      const buttons = game.phase === 'lobby' ? [
        { text: '🕯️ Gabung (.ww join)', id: '.ww join' },
        ...(game.players.size >= MIN_PLAYERS ? [{ text: '⚔️ Mulai (.ww begin)', id: '.ww begin' }] : [])
      ] : [
        { text: '📩 Cek Role Saya', id: '.ww myrole' }
      ];

      if (m.sendButtons) {
        return await m.sendButtons(textPlayers, buttons, 'Werewolf • Pemain');
      }
      return reply(textPlayers);
    }

    case 'roles':
    case 'role': {
      const textRoles = rolesText();
      const buttons = [
        { text: '🐺 Buka Lobby (.ww start)', id: '.ww start' }
      ];
      if (m.sendButtons) {
        return await m.sendButtons(textRoles, buttons, 'Werewolf • Roles');
      }
      return reply(textRoles);
    }

    case 'myrole': {
      if (!game) return reply('Belum ada game di grup ini.');
      const err = await resendRole(game, m.sender);
      if (err) return reply(err);
      if (m.react) return m.react('📩');
      return reply('Role telah dikirim ke DM.');
    }

    case 'begin': {
      if (!game) return reply('Belum ada lobby. Ketik *.ww start* dulu.');
      if (m.sender !== game.hostJid) return reply('Cuma host yang bisa mulai game.');
      if (game.phase !== 'lobby') return reply('Game udah jalan.');
      if (game.players.size < MIN_PLAYERS) {
        const textKurang = `Pemain kurang. Butuh minimal ${MIN_PLAYERS}, sekarang baru ${game.players.size}.`;
        const buttons = [
          { text: '🕯️ Gabung (.ww join)', id: '.ww join' }
        ];
        if (m.sendButtons) {
          return await m.sendButtons(textKurang, buttons, 'Werewolf • Butuh Pemain');
        }
        return reply(textKurang);
      }
      if (m.react) await m.react('⏳');
      const err = await startGame(game);
      if (err) {
        if (m.react) await m.react('❎');
        return reply(err);
      }
      return;
    }

    case 'stop': {
      if (!game) return reply('Gak ada game di grup ini.');
      if (m.sender !== game.hostJid) return reply('Cuma host yang bisa bubarin game.');
      stopGame(m.chat, client);
      const textStop = '🛑 _Kabut menghilang. Desa itu kembali sunyi..._\nGame Werewolf dibubarin.';
      const buttons = [
        { text: '🐺 Buka Lobby Baru', id: '.ww start' }
      ];
      if (m.sendButtons) {
        return await m.sendButtons(textStop, buttons, 'Werewolf • Selesai');
      }
      return reply(textStop);
    }

    default: {
      const buttons = [
        { text: '🌑 Buka Lobby (.ww start)', id: '.ww start' },
        { text: '📖 Daftar Role (.ww roles)', id: '.ww roles' }
      ];
      if (m.sendButtons) {
        return await m.sendButtons(HELP, buttons, 'Werewolf • Menu');
      }
      return reply(HELP);
    }
  }
};

handler.command = ['ww', 'werewolf'];
handler.category = 'Games';
handler.desc = 'Game Werewolf (WW) interaktif khusus grup';

handler.limit = false;
handler.owner = false;
handler.premium = false;
handler.group = true;
handler.private = false;
handler.register = true;
handler.delay = true;
export default handler;
