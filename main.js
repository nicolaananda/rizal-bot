require('./settings')
const { default: makeWaSocket, useMultiFileAuthState, DisconnectReason, generateForwardMessageContent, prepareWAMessageMedia, generateWAMessageFromContent, generateMessageID, downloadContentFromMessage, jidDecode, proto, fetchLatestBaileysVersion } = require("@dappaoffc/baileys")

const pino = require('pino')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const axios = require('axios')
const chalk = require('chalk');
const figlet = require('figlet');
const FileType = require('file-type')
const PhoneNumber = require('awesome-phonenumber')
const { smsg, getBuffer, fetchJson } = require('./lib/simple')
const fetch = require('node-fetch')
const {
   imageToWebp,
   videoToWebp,
   writeExifImg,
   writeExifVid,
   writeExif
} = require('./lib/exif')
const { isSetClose,
    addSetClose,
    removeSetClose,
    changeSetClose,
    getTextSetClose,
    isSetDone,
    addSetDone,
    removeSetDone,
    changeSetDone,
    getTextSetDone,
    isSetLeft,
    addSetLeft,
    removeSetLeft,
    changeSetLeft,
    getTextSetLeft,
    isSetOpen,
    addSetOpen,
    removeSetOpen,
    changeSetOpen,
    getTextSetOpen,
    isSetProses,
    addSetProses,
    removeSetProses,
    changeSetProses,
    getTextSetProses,
    isSetWelcome,
    addSetWelcome,
    removeSetWelcome,
    changeSetWelcome,
    getTextSetWelcome,
    addSewaGroup,
    getSewaExpired,
    getSewaPosition,
    expiredCheck,
    checkSewaGroup
} = require("./lib/store")

let set_welcome_db = JSON.parse(fs.readFileSync('./database/set_welcome.json'));
let set_left_db = JSON.parse(fs.readFileSync('./database/set_left.json'));
let _welcome = JSON.parse(fs.readFileSync('./database/welcome.json'));
let _left = JSON.parse(fs.readFileSync('./database/left.json'));
let set_proses = JSON.parse(fs.readFileSync('./database/set_proses.json'));
let set_done = JSON.parse(fs.readFileSync('./database/set_done.json'));
let set_open = JSON.parse(fs.readFileSync('./database/set_open.json'));
let set_close = JSON.parse(fs.readFileSync('./database/set_close.json'));
let sewa = JSON.parse(fs.readFileSync('./database/sewa.json'));
let setpay = JSON.parse(fs.readFileSync('./database/pay.json'));
let opengc = JSON.parse(fs.readFileSync('./database/opengc.json'));
let antilink = JSON.parse(fs.readFileSync('./database/antilink.json'));
let antiwame = JSON.parse(fs.readFileSync('./database/antiwame.json'));
let antilink2 = JSON.parse(fs.readFileSync('./database/antilink2.json'));
let antiwame2 = JSON.parse(fs.readFileSync('./database/antiwame2.json'));
let db_respon_list = JSON.parse(fs.readFileSync('./database/list.json'));
const {
   toBuffer,
   toDataURL
} = require('qrcode')
const express = require('express')
let app = express()
const {
   createServer
} = require('http')
let server = createServer(app)
let _qr = 'invalid'
let PORT = process.env.PORT
const path = require('path')

const store = { }

const readline = require("readline");
const usePairingCode = true
const question = (text) => {
  const rl = readline.createInterface({
input: process.stdin,
output: process.stdout
  });
  return new Promise((resolve) => {
rl.question(text, resolve)
  })
};
async function Botstarted() {
const auth = await useMultiFileAuthState("auth");
const { state, saveCreds } = await useMultiFileAuthState('auth')
const { version, isLatest } = await fetchLatestBaileysVersion()
const arap = makeWaSocket({
printQRInTerminal: !usePairingCode,
browser: ["Ubuntu", "Chrome", "20.0.04"],
auth: auth.state,
logger: pino({ level: "silent" }),
});

if(usePairingCode && !arap.authState.creds.registered) {
console.log('Silahkan Masukkan Nomor Berawal Dari 62:')
		const phoneNumber = await question('');
		const code = await arap.requestPairingCode(phoneNumber.trim())
		console.log(`Pairing Code : ${code}`)
}
	
arap.ev.on("creds.update", auth.saveCreds);

    arap.ev.on('messages.upsert', async chatUpdate => {
        //console.log(JSON.stringify(chatUpdate, undefined, 2))
        try {
        mek = chatUpdate.messages[0]
        if (!mek.message) return
        mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
        if (mek.key && mek.key.remoteJid === 'status@broadcast') return
        if (!arap.public && !mek.key.fromMe && chatUpdate.type === 'notify') return
        if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return
        m = smsg(arap, mek, store)
        require("./arap")(arap, m, chatUpdate, store, opengc, setpay, antilink, antiwame, antilink2, antiwame2, set_welcome_db, set_left_db, set_proses, set_done, set_open, set_close, sewa, _welcome, _left, db_respon_list)
        } catch (err) {
            console.log(err)
        }
    })
    setInterval(() => {
        for (let i of Object.values(opengc)) {
            if (Date.now() >= i.time) {
                arap.groupSettingUpdate(i.id, "not_announcement")
                .then((res) =>
                arap.sendMessage(i.id, { text: `Sukses, group telah dibuka` }))
                .catch((err) =>
                arap.sendMessage(i.id, { text: 'Error' }))
                delete opengc[i.id]
                fs.writeFileSync('./database/opengc.json', JSON.stringify(opengc))
            }
        }
    }, 1000)    

    arap.ev.on('group-participants.update', async (anu) => {
        const isWelcome = _welcome.includes(anu.id)
        const isLeft = _left.includes(anu.id)
        try {
            let metadata = await arap.groupMetadata(anu.id)
            let participants = anu.participants
            const groupName = metadata.subject
  		      const groupDesc = metadata.desc
            for (let num of participants) {
                try {
                    ppuser = await arap.profilePictureUrl(num, 'image')
                } catch {
                    ppuser = 'https://telegra.ph/file/c3f3d2c2548cbefef1604.jpg'
                }

                try {
                    ppgroup = await arap.profilePictureUrl(anu.id, 'image')
                } catch {
                    ppgroup = 'https://telegra.ph/file/c3f3d2c2548cbefef1604.jpg'
                }
                if (anu.action == 'add' && isWelcome) {
                  console.log(anu)
                    if (isSetWelcome(anu.id, set_welcome_db)) {               	
                        var get_teks_welcome = await getTextSetWelcome(anu.id, set_welcome_db)
                    var replace_pesan = (get_teks_welcome.replace(/@user/gi, `@${num.split('@')[0]}`))
                        var full_pesan = (replace_pesan.replace(/@group/gi, groupName).replace(/@desc/gi, groupDesc))
                        arap.sendMessage(anu.id, { image: { url: ppuser }, mentions: [num], caption: `${full_pesan}` })
                       } else {
                       	arap.sendMessage(anu.id, { image: { url: ppuser }, mentions: [num], caption: `_Halo Kakak_ 👋 @${num.split("@")[0]}, _Welcome To_ ${metadata.subject}` })
                      }
                } else if (anu.action == 'remove' && isLeft) {
                	console.log(anu)
                  if (isSetLeft(anu.id, set_left_db)) {            	
                        var get_teks_left = await getTextSetLeft(anu.id, set_left_db)
                        var replace_pesan = (get_teks_left.replace(/@user/gi, `@${num.split('@')[0]}`))
                        var full_pesan = (replace_pesan.replace(/@group/gi, groupName).replace(/@desc/gi, groupDesc))
                      arap.sendMessage(anu.id, { image: { url: ppuser }, mentions: [num], caption: `${full_pesan}` })
                       } else {
                       	arap.sendMessage(anu.id, { image: { url: ppuser }, mentions: [num], caption: `_Telah keluar dari sirkel, kalau balik lagi jangan lupa bawa gorengan sebaskom ye 😆_ @${num.split("@")[0]}` })
                        }
                        } else if (anu.action == 'promote') {
                    arap.sendMessage(anu.id, { image: { url: ppuser }, mentions: [num], caption: `@${num.split('@')[0]} Anjay Sekarang Menjadi Admin Grup ${metadata.subject}` })
                } else if (anu.action == 'demote') {
                    arap.sendMessage(anu.id, { image: { url: ppuser }, mentions: [num], caption: `@${num.split('@')[0]} Awokwoakwok Bukan Admin Grup ${metadata.subject} Lagi` })
              }
            }
        } catch (err) {
            console.log(err)
        }
    })
	const sleep = async (ms) => {
return new Promise(resolve => setTimeout(resolve, ms));
}
    // Setting
arap.ev.process(
async (events) => {
if (events['messages.upsert']) {
const upsert = events['messages.upsert']
for (let m of upsert.messages) {
if (m.key.remoteJid === 'status@broadcast') {
await arap.readMessages([m.key])
}}}})
    
    arap.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {}
            return decode.user && decode.server && decode.user + '@' + decode.server || jid
        } else return jid
    }
    
    arap.ev.on('contacts.update', update => {
        for (let contact of update) {
            let id = arap.decodeJid(contact.id)
            if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
        }
    })

    arap.getName = (jid, withoutContact  = false) => {
        id = arap.decodeJid(jid)
        withoutContact = arap.withoutContact || withoutContact 
        let v
        if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
            v = store.contacts[id] || {}
            if (!(v.name || v.subject)) v = arap.groupMetadata(id) || {}
            resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
        })
        else v = id === '0@s.whatsapp.net' ? {
            id,
            name: 'WhatsApp'
        } : id === arap.decodeJid(arap.user.id) ?
            arap.user :
            (store.contacts[id] || {})
            return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
    }
    
    arap.sendContact = async (jid, kon, quoted = '', opts = {}) => {
	let list = []
	for (let i of kon) {
	    list.push({
	    	displayName: await arap.getName(i + '@s.whatsapp.net'),
	    	vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${await arap.getName(i + '@s.whatsapp.net')}\nFN:${await arap.getName(i + '@s.whatsapp.net')}\nitem1.TEL;waid=${i}:${i}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
	    })
	}
	arap.sendMessage(jid, { contacts: { displayName: `${list.length} Kontak`, contacts: list }, ...opts }, { quoted })
    }
    
    arap.sendContac = async (jid, kon, opts = {}) => {
	let list = []
	for (let i of kon) {
	    list.push({
	    	displayName: await arap.getName(i + '@s.whatsapp.net'),
	    	vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${await arap.getName(i + '@s.whatsapp.net')}\nFN:${global.namaowner}\nitem1.TEL;waid=${i}:${i}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
	    })
	}
	arap.sendMessage(jid, { contacts: { displayName: `${list.length} Kontak`, contacts: list }, ...opts })
    }
    
    arap.ws.on('CB:call', async (json) => {
        const callerId = json.content[0].attrs['call-creator']
        arap.sendMessage(callerId, { text: `Maaf Bot Tidak Menerima Telepon Kamu Akan Diblokir. Silahkan Hubungi Owner Untuk Membuka Blok !` })
        arap.sendContac(callerId, global.owner)
        await sleep(1)
        arap.updateBlockStatus(callerId, 'block')
    })
    
    
    arap.public = true

    arap.serializeM = (m) => smsg(arap, m, store)


arap.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !usePairingCode) {
            console.log(chalk.magenta('Pindai QR code ini dengan WhatsApp Anda...'));
        }

        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
            const reasonText = DisconnectReason[reason] || 'Tidak Diketahui';
            console.log(chalk.redBright(`Koneksi Tertutup, Alasan: ${reasonText} (${reason})`));

            if (
                reason === DisconnectReason.badSession ||
                reason === DisconnectReason.loggedOut ||
                reason === DisconnectReason.connectionReplaced ||
                reason === DisconnectReason.multideviceMismatch
            ) {
                console.log(chalk.red("Error Sesi Kritis. Mematikan bot... Harap hapus folder 'auth' dan mulai ulang."));
                process.exit(1);
            } else {
                console.log(chalk.yellow("Koneksi terputus, mencoba memulai ulang bot..."));
                Botstarted();
            }
        }

        if (connection === "open") {
            console.clear();
            console.log(chalk.red(await figlet.text('YZ BOT', { font: 'Standard' })));
            console.log(chalk.green(`Terhubung sebagai = ` + JSON.stringify(arap.user, null, 2)));
        }
    });

    arap.sendText = (jid, text, quoted = '', options) => arap.sendMessage(jid, { text: text, ...options }, { quoted, ...options })

arap.downloadMediaMessage = async (message) => {
      let mime = (message.msg || message).mimetype || ''
      let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
      const stream = await downloadContentFromMessage(message, messageType)
      let buffer = Buffer.from([])
      for await (const chunk of stream) {
         buffer = Buffer.concat([buffer, chunk])
      }

      return buffer
   }
   
arap.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {

        let quoted = message.msg ? message.msg : message

        let mime = (message.msg || message).mimetype || ''
        let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
        const stream = await downloadContentFromMessage(quoted, messageType)
        let buffer = Buffer.from([])
        for await(const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk])
        }
	let type = await FileType.fromBuffer(buffer)
        trueFileName = attachExtension ? (filename + '.' + type.ext) : filename
        // save to file
        await fs.writeFileSync(trueFileName, buffer)
        return trueFileName
    }
arap.sendTextWithMentions = async (jid, text, quoted, options = {}) => arap.sendMessage(jid, {
      text: text,
      mentions: [...text.matchAll(/@(\d{0,16})/g)].map(v => v[1] + '@s.whatsapp.net'),
      ...options
   }, {
      quoted
   })

   arap.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
      let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,` [1], 'base64') : /^https?:\/\//.test(path) ? await (await fetch(path)).buffer() : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
      let buffer
      if (options && (options.packname || options.author)) {
         buffer = await writeExifImg(buff, options)
      } else {
         buffer = await imageToWebp(buff)
      }

      await arap.sendMessage(jid, {
         sticker: {
            url: buffer
         },
         ...options
      }, {
         quoted
      })
      return buffer
   }

   /**
    * 
    * @param {*} jid 
    * @param {*} path 
    * @param {*} quoted 
    * @param {*} options 
    * @returns 
    */
   arap.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
      let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,` [1], 'base64') : /^https?:\/\//.test(path) ? await getBuffer(path) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
      let buffer
      if (options && (options.packname || options.author)) {
         buffer = await writeExifVid(buff, options)
      } else {
         buffer = await videoToWebp(buff)
      }

      await arap.sendMessage(jid, {
         sticker: {
            url: buffer
         },
         ...options
      }, {
         quoted
      })
      return buffer
   }

    return arap
}


Botstarted()