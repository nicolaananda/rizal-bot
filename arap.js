require('./settings')
const { BufferJSON, WA_DEFAULT_EPHEMERAL, generateWAMessageFromContent, proto, generateWAMessageContent, generateWAMessage, prepareWAMessageMedia, areJidsSameUser, getContentType } = require("@dappaoffc/baileys")
const fs = require('fs');
const util = require('util');
const chalk = require('chalk');
const axios = require('axios');
const moment = require('moment-timezone');
const ms = toMs = require('ms');
const FormData = require("form-data");
const { fromBuffer } = require('file-type')
const fetch = require('node-fetch')
const Jimp = require('jimp');
const QRCode = require('qrcode'); 
const crypto = require('crypto');
const mongoose = require('mongoose'); 
let set_bot = JSON.parse(fs.readFileSync('./database/set_bot.json'));
const cheerio = require('cheerio'); // Pastikan cheerio sudah di-require
const { HttpsProxyAgent } = require('https-proxy-agent');
let topupPath = "./GATEWAY/topup/"

const PROXY_URL = global.proxy;
const axiosInstance = axios.create({
    httpsAgent: PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : null
});
// Helper: Generate invoice image using Jimp and background at ./image/bg.png
async function generateInvoiceBuffer(details) {
    const bgPath = './image/bg.png';
    if (!fs.existsSync(bgPath)) {
        throw new Error('Background invoice ./image/bg.png tidak ditemukan');
    }
    const image = await Jimp.read(bgPath);
    const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
    const fontMedium = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    const fontBig = fontMedium; // Bisa ganti ke FONT_SANS_64_WHITE jika mau status lebih besar

    // Set posisi field agar sesuai bg.png
    // Header:
    image.print(fontSmall, 105, 80, details.date || '-'); // DATE
    image.print(fontSmall, 285, 80, details.invoiceId || '-'); // NO INVOICE
    image.print(fontMedium, 433, 80, details.status || 'SUCCESS'); // STATUS (box sudah ada di bg)

    // Body kolom kiri
    let yProduk = 175;
    image.print(fontSmall, 180, yProduk, details.product || '-');           // PRODUK
    image.print(fontSmall, 180, yProduk + 40, details.variant || '-');      // VARIAN
    image.print(fontSmall, 180, yProduk + 80, `Rp${details.harga || '-'}`); // HARGA

    // Buyer info
    if(details.buyer){
        image.print(fontSmall, 180, yProduk + 120, `No Buyer: ${details.buyer}`);
    }

    // SN block (pakai fontMedium dan lebih besar)
    image.print(fontMedium, 120, 295, details.sn ? `SN -> ${details.sn}` : 'SN -> -');

    return await image.getBufferAsync(Jimp.MIME_PNG);
}

const { smsg, fetchJson, getBuffer } = require('./lib/simple')
const { 
  isSetBot,
    addSetBot,
    removeSetBot,
    changeSetBot,
    getTextSetBot,
  updateResponList,
  delResponList,
  renameList,
  isAlreadyResponListGroup,
  sendResponList,
  isAlreadyResponList,
  getDataResponList,
  addResponList,
  isSetClose,
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
    checkSewaGroup,
    addPay,
    updatePay
} = require("./lib/store")


const mongoUri = global.mongodblink;
if (mongoUri) {
    mongoose.connect(mongoUri, {}).then(() => {
        console.log(chalk.green('✅ Terhubung ke MongoDB!'));
    }).catch(err => {
        console.error(chalk.red('❌ Gagal terhubung ke MongoDB:', err));
    });
} else {
    console.error(chalk.red('❌ global.mongodblink belum didefinisikan di settings.js.'));
}

async function getGroupAdmins(participants){
        let admins = []
        for (let i of participants) {
            i.admin === "superadmin" ? admins.push(i.id) :  i.admin === "admin" ? admins.push(i.id) : ''
        }
        return admins || []
}

const transactionSchema = new mongoose.Schema({
    userId: String,
    userName: String,
    productName: String,
    variantName: String,
    quantity: Number,
    price: Number,
    discountPrice: Number,
    fee: Number,
    totalAmountPaid: Number,
    timestamp: { type: Date, default: Date.now }
});

const Transaction = mongoose.model('Transaction', transactionSchema);

async function saveTransactionRecord_Rap(userId, userName, productName, variantName, quantity, price, discountPrice, fee, totalAmountPaid) {
    try {
        const newTransaction = new Transaction({
            userId,
            userName,
            productName,
            variantName,
            quantity,
            price,
            discountPrice,
            fee,
            totalAmountPaid,
            timestamp: new Date()
        });
        await newTransaction.save();
        console.log(`✅ Transaksi profit berhasil dicatat di Database untuk user: ${userName}`);
    } catch (err) {
        console.error("❌ Gagal mencatat transaksi ke MongoDB:", err);
    }
}

const warrantyClaimSchema = new mongoose.Schema({
    claimId: { type: String, unique: true, required: true },
    userJid: { type: String, required: true },
    userName: { type: String },
    claimType: { type: String, enum: ['image', 'text'], required: true },
    claimContent: { type: String, required: true },
    claimReason: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const WarrantyClaim = mongoose.model('WarrantyClaim', warrantyClaimSchema);

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', counterSchema);

async function getNextClaimId(sequenceName) {
    const sequenceDocument = await Counter.findByIdAndUpdate(
        sequenceName,
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return `garansi-${sequenceDocument.seq}`;
}

const variantSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: String,
    desc: String,
    snk: String,
    price: Number,
    stok: [String],
    terjual: { type: Number, default: 0 },
    discount: Object,
});

const productSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true },
    name: String,
    desc: String,
    variants: { type: Map, of: variantSchema },
    terjual: { type: Number, default: 0 },
});

const Produk = mongoose.model('Produk', productSchema);

const userSchema = new mongoose.Schema({
    nomor: { type: String, unique: true, required: true },
    nama: String,
    balance: { type: Number, default: 0 },
    registeredAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const pendingOrderSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    userName: { type: String },
    orderId: { type: String, required: true, unique: true },
    transactionId: { type: String, required: true },
    productId: { type: String, required: true },
    variantId: { type: String, required: true },
    productName: String, 
    variantName: String, 
    jumlah: { type: Number, required: true },
    totalBayar: { type: Number, required: true }, 
    qrMessageKey: Object, 
    qrMessageChatId: String, 
    status: String, 
    expireAt: { type: Date, required: true },
    timestamp: { type: Date, default: Date.now },
    pushname: String, 
    type: { type: String, required: true }, 
    reservedStock: [String],
    hargaSatuanOriginal: Number, 
    hargaSetelahDiskon: Number, 
    feeAdmin: Number, 
    jumlahDeposit: Number,
    userNomor: String,
    feeAdmin: Number,
    createdAt: { type: Date, default: Date.now }
});

const PendingOrder = mongoose.model('PendingOrder', pendingOrderSchema);;

const jam = moment.tz('asia/jakarta').format('HH:mm:ss');

function TelegraPh (Path) {
    return new Promise (async (resolve, reject) => {
        if (!fs.existsSync(Path)) return reject(new Error("File not Found"))
        try {
            const form = new FormData();
            form.append("file", fs.createReadStream(Path))
            const data = await  axios({
                url: "https://telegra.ph/upload",
                method: "POST",
                headers: {
                    ...form.getHeaders()
                },
                data: form
            })
            return resolve("https://telegra.ph" + data.data[0].src)
        } catch (err) {
            return reject(new Error(String(err)))
        }
    })
}

const RESTOCK_NOTIF_PATH = './database/restock_notifications.json';

function loadRestockNotifications() {
    if (!fs.existsSync(RESTOCK_NOTIF_PATH)) {
        fs.writeFileSync(RESTOCK_NOTIF_PATH, JSON.stringify({}, null, 2));
        return {};
    }
    try {
        const data = fs.readFileSync(RESTOCK_NOTIF_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error("Error membaca restock_notifications.json:", e);
        fs.writeFileSync(RESTOCK_NOTIF_PATH, JSON.stringify({}, null, 2));  
        return {};
    }
}
function addRestockSubscriber(variantId, userJid) {
    const notifications = loadRestockNotifications();
    if (!notifications[variantId]) {
        notifications[variantId] = [];
    }
    
    if (!notifications[variantId].includes(userJid)) {
        notifications[variantId].push(userJid);
        return saveRestockNotifications(notifications);
    }
    return true; 
}

function getRestockSubscribers(variantId) {
    const notifications = loadRestockNotifications();
    return notifications[variantId] || [];
}

function clearRestockSubscribers(variantId) {
    const notifications = loadRestockNotifications();
    if (notifications[variantId]) {
        delete notifications[variantId];
        return saveRestockNotifications(notifications);
    }
    return true;
}

function saveRestockNotifications(notifications) {
    try {
        fs.writeFileSync(RESTOCK_NOTIF_PATH, JSON.stringify(notifications, null, 2));
        return true;
    } catch (e) {
        console.error("Error menyimpan restock_notifications.json:", e);
        return false;
    }
}

function isRestockSubscriber(variantId, userJid) {
    const notifications = loadRestockNotifications();
    return notifications[variantId]?.includes(userJid) || false;
}

async function loadUsers_Rap() {
    try {
        const userDocs = await User.find({});
        return userDocs.map(doc => doc.toObject());
    } catch (err) {
        console.error("❌ Gagal memuat data pengguna dari Database:", err);
        return [];
    }
}

async function saveUsers_Rap(usersData) {
    try {

        await User.deleteMany({});
        if (usersData.length > 0) {
            await User.insertMany(usersData);
        }
        return true;
    } catch (err) {
        console.error("❌ Gagal menyimpan data pengguna ke Database:", err);
        return false;
    }
}

async function getUniqueTotalBayar(initialAmount) {
    let finalAmount = initialAmount;
    let isUnique = false;
    let attempts = 0; 

    while (!isUnique && attempts < 20) {
        const recentTransactions = await Transaction.find({})
            .sort({ timestamp: -1 })
            .limit(10)
            .select('totalAmountPaid');
        
        const recentAmounts = recentTransactions.map(trx => trx.totalAmountPaid);

        if (recentAmounts.includes(finalAmount)) {
            console.log(`[NOMINAL CHECK] Duplikat ditemukan untuk Rp ${finalAmount}. Menambah 10 perak.`);
            finalAmount += 10; // Tambahkan 10 perak jika duplikat
            attempts++;
        } else {
            console.log(`[NOMINAL CHECK] Nominal Rp ${finalAmount} unik dan bisa digunakan.`);
            isUnique = true; // Nominal unik, hentikan loop
        }
    }
    return finalAmount;
}



async function loadProdukData_Rap() {
    try {
        const produkDocs = await Produk.find({});
        const produkObj = {};
        produkDocs.forEach(doc => {
            produkObj[doc.id] = doc.toObject();
        });
        return produkObj;
    } catch (err) {
        console.error("❌ Gagal memuat data produk dari MongoDB:", err);
        return {};
    }
}
async function saveProdukData_Rap(produkObj) {
    try {
        for (const id in produkObj) {
            await Produk.findOneAndUpdate({ id: id }, produkObj[id], { upsert: true, new: true });
        }
        return true;
    } catch (err) {
        console.error("❌ Gagal menyimpan data produk ke MongoDB:", err);
        return false;
    }
}

const TRANSACTION_DIR_BALZ = './database/transactions/';


async function getPendingOrders_Rap() {
    try {
        const orderDocs = await PendingOrder.find({});
        const ordersObj = {};
        orderDocs.forEach(doc => {
            ordersObj[doc.userId] = doc.toObject();
        });
        return ordersObj;
    } catch (err) {
        console.error("❌ Gagal memuat pesanan pending dari Database:", err);
        return {};
    }
}

async function savePendingOrders_Rap(orders) {
    try {
        await PendingOrder.deleteMany({});
        const ordersArray = Object.values(orders);
        if (ordersArray.length > 0) {
            await PendingOrder.insertMany(ordersArray);
        }
    } catch (err) {
        console.error("❌ Gagal menyimpan pesanan pending ke MongoDB:", err);
    }
}


function toCRC16(str) {
  function charCodeAt(str, i) {
    let get = str.substr(i, 1);
    return get.charCodeAt();
  }

  let crc = 0xFFFF;
  let strlen = str.length;
  for (let c = 0; c < strlen; c++) {
    crc ^= charCodeAt(str, c) << 8;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  let hex = crc & 0xFFFF;
  hex = hex.toString(16).toUpperCase();
  while (hex.length < 4) { 
    hex = "0" + hex;
  }
  return hex;
}
async function qrisDinamis_Rap(nominal, senderId) {
  if (!global.codeqr) {
    console.error("Variabel global.codeqr (template QRIS statis) belum didefinisikan di settings.js!");
    throw new Error("Template QRIS statis belum dikonfigurasi.");
  }

  let qris = global.codeqr;
  let qrisDihapusCRC = qris.slice(0, -4); 
  

  let panjangNominalStr = nominal.toString().length.toString().padStart(2, '0');
  const tagNominal = "54" + panjangNominalStr + nominal.toString();
  
  let qrisTanpaNominalLama;

  if (qrisDihapusCRC.includes("540")) { 

      qrisTanpaNominalLama = qrisDihapusCRC.replace(/54\d{2}\d+/, ''); 
  } else {
      qrisTanpaNominalLama = qrisDihapusCRC;
  }

  let titikSisip = qrisTanpaNominalLama.indexOf("5802ID");
  if (titikSisip === -1) {
      titikSisip = qrisTanpaNominalLama.indexOf("59"); 
      if (titikSisip === -1) {
          console.error("Tidak dapat menemukan titik sisip standar (5802ID atau 59) pada template QRIS Anda (global.codeqr).");
          throw new Error("Format template QRIS tidak sesuai untuk penyisipan nominal dinamis. Periksa global.codeqr.");
      }
  }
  
  let bagianAwal = qrisTanpaNominalLama.substring(0, titikSisip);
  let bagianAkhir = qrisTanpaNominalLama.substring(titikSisip);
  
  let stringUntukCRC = bagianAwal + tagNominal + bagianAkhir;
  let crcBaru = toCRC16(stringUntukCRC);
  let outputFinalQRISString = stringUntukCRC + crcBaru;

const qrDir = './database/qr_arap/'; 
  if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });

  const outputPath = `${qrDir}qr_payment_${senderId}_${Date.now()}.jpg`;

  try {
    await QRCode.toFile(outputPath, outputFinalQRISString, { margin: 2, scale: 10, errorCorrectionLevel: 'M' });
    console.log(`QRIS Dinamis (Balz) berhasil dibuat untuk Rp ${nominal} di: ${outputPath}`);
    return outputPath;
  } catch (err) {
    console.error("Gagal membuat file QR code (Balz):", err);
    throw err; 
  }
}

function generateRandomFee_Rap(min = 1, max = 100) {
    return (Math.floor(Math.random() * (max - min + 1)) + min);
}

async function saveSinglePendingOrder_Rap(orderData) {
    try {
        await PendingOrder.findOneAndUpdate({ userId: orderData.userId }, orderData, { upsert: true, new: true });
        return true;
    } catch (err) {
        console.error("❌ Gagal menyimpan pending order ke MongoDB:", err);
        return false;
    }
}


const checkDepo_Rap = async (botInstance, senderJd) => {
    let orderDetails = await PendingOrder.findOne({ userId: senderJd });
    if (!orderDetails || orderDetails.type !== "deposit") return;

    console.log(`[DEPOSIT CHECK] Memulai loop pengecekan mutasi untuk ${senderJd} sebesar Rp ${toRupiah(orderDetails.totalBayar)}...`);

    if (!global.angka) {
        console.error("❌ FATAL ERROR: `global.pass` tidak diatur di settings.js!");
        await PendingOrder.deleteOne({ userId: senderJd });
        return botInstance.sendMessage(senderJd, { text: "Terjadi kesalahan konfigurasi server. Deposit Anda dibatalkan. Mohon hubungi admin." });
    }

    const dataPath = './GATEWAY/dataorkut.json';
    let payload;
    try {
        payload = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch (err) {
        console.error(`❌ FATAL ERROR: Gagal memuat ${dataPath}.`, err);
        await PendingOrder.deleteOne({ userId: senderJd });
        return botInstance.sendMessage(senderJd, { text: "Terjadi kesalahan konfigurasi server. Deposit Anda dibatalkan." });
    }
    
    const formattedAmount = Number(orderDetails.totalBayar).toLocaleString('id-ID');
    const url = `https://app.orderkuota.com/api/v2/qris/mutasi/${global.angka}`; // URL dinamis

    let paymentConfirmed = false;
    const timeout = 300; // 5 menit
    let elapsed = 0;

    while (elapsed < timeout && !paymentConfirmed) {
        const stillPending = await PendingOrder.findOne({ userId: senderJd });
        if (!stillPending) {
            console.log(`[DEPOSIT CHECK] Order untuk ${senderJd} telah dibatalkan, loop dihentikan.`);
            return;
        }

        try {
 
            const timestamp = Date.now().toString();
            const signature = crypto.randomBytes(32).toString('hex');
            payload.request_time = timestamp;

            const headers = {
                'signature': signature,
                'timestamp': timestamp,
                'content-type': 'application/x-www-form-urlencoded',
                'user-agent': 'okhttp/4.12.0',
            };

            const res = await axios.post(url, new URLSearchParams(payload), { headers, timeout: 45000 });
            const history = res.data.qris_history?.results?.[0];

            if (history) {
                const kredit = history.kredit?.trim();
                console.log(`[DEPOSIT CHECK] API Check: Menunggu ${formattedAmount}, Mutasi terbaru adalah ${kredit}`);
                if (kredit === formattedAmount) {
                    console.log(`[DEPOSIT CHECK] ✅ Pembayaran cocok ditemukan: ${kredit}`);
                    paymentConfirmed = true;
                }
            }
        } catch (err) {
            console.error("❌ Error saat cek mutasi deposit:", err.message);
        }

        if (!paymentConfirmed) {
            await new Promise(res => setTimeout(res, 10000)); // Cek setiap 10 detik
            elapsed += 10;
        }
    }


    if (paymentConfirmed) {
        if (orderDetails.qrMessageKey) {
            try { await botInstance.sendMessage(senderJd, { delete: orderDetails.qrMessageKey }); } catch (e) {}
        }
        
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            await botInstance.sendMessage(senderJd, { text: `Pembayaran deposit Anda sebesar Rp ${toRupiah(orderDetails.jumlahDeposit)} telah berhasil! Saldo Anda akan segera diperbarui.` });
            

            await User.findOneAndUpdate(
                { nomor: orderDetails.userNomor }, 
                { $inc: { balance: Number(orderDetails.jumlahDeposit) } }, 
                { new: true, session }
            );

            const now = new Date();
            const tanggal = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
            const jam = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            
            const ownerToNotify = global.owner[0];
            if (ownerToNotify) {
                let ownerMsg = `🔔 *DEPOSIT SALDO BERHASIL* 🔔\n\n- Pengguna: ${orderDetails.pushname} (@${senderJd.split("@")[0]})\n- Jumlah: Rp ${toRupiah(orderDetails.jumlahDeposit)}\n- Total Bayar: Rp ${toRupiah(orderDetails.totalBayar)}\n- Waktu: ${tanggal} | ${jam} WIB`;
                await botInstance.sendMessage(ownerToNotify.replace(/[^0-9]/g, '') + '@s.whatsapp.net', { text: ownerMsg, mentions: [senderJd] });
            }
            
            await saveTransactionRecord_Rap(senderJd.split('@')[0], orderDetails.pushname, "Deposit Saldo", "-", 1, orderDetails.jumlahDeposit, orderDetails.jumlahDeposit, orderDetails.feeAdmin, orderDetails.totalBayar);
            await PendingOrder.deleteOne({ userId: senderJd }).session(session);
            await session.commitTransaction();
            session.endSession();
        } catch (finalizationError) {
            await session.abortTransaction(); session.endSession();
            console.error(`[ERROR] Gagal finalisasi deposit:`, finalizationError);
            await PendingOrder.deleteOne({ userId: senderJd });
        }
    } else {
        const finalCheck = await PendingOrder.findOne({ userId: senderJd });
        if (finalCheck) {
            if (finalCheck.qrMessageKey) {
                try { await botInstance.sendMessage(senderJd, { delete: finalCheck.qrMessageKey }); } catch (e) {}
            }
            await botInstance.sendMessage(senderJd, { text: `Waktu pembayaran deposit telah habis dan dibatalkan.` });
            await PendingOrder.deleteOne({ userId: senderJd });
        }
    }
};

const checkPaymentStatus_Rap = async (botInstance, senderJd) => {
    let orderDetails = await PendingOrder.findOne({ userId: senderJd });
    if (!orderDetails || orderDetails.type !== "buy") return; 

    console.log(`[CHECK MUTASI] Memulai loop pengecekan untuk ${senderJd} sebesar Rp ${toRupiah(orderDetails.totalBayar)}...`);


    if (!global.angka) {
        console.error("❌ FATAL ERROR: `global.pass` tidak diatur di settings.js!");
    
        await PendingOrder.deleteOne({ userId: senderJd });
        return botInstance.sendMessage(senderJd, { text: "Terjadi kesalahan konfigurasi server. Pesanan Anda dibatalkan. Mohon hubungi admin." });
    }

    const dataPath = './GATEWAY/dataorkut.json';
    let payload;
    try {
        payload = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch (err) {
        console.error(`❌ FATAL ERROR: Gagal memuat ${dataPath}.`, err);
        await PendingOrder.deleteOne({ userId: senderJd });
        return botInstance.sendMessage(senderJd, { text: "Terjadi kesalahan konfigurasi server. Pesanan Anda dibatalkan." });
    }
    
    const formattedAmount = Number(orderDetails.totalBayar).toLocaleString('id-ID');
    const url = `https://app.orderkuota.com/api/v2/qris/mutasi/${global.angka}`; // URL dinamis dengan angka

    let paymentConfirmed = false;
    const timeout = 300; // 5 menit
    let elapsed = 0;


    while (elapsed < timeout && !paymentConfirmed) {
        const stillPending = await PendingOrder.findOne({ userId: senderJd });
        if (!stillPending) {
            console.log(`[CHECK MUTASI] Order untuk ${senderJd} telah dibatalkan, loop dihentikan.`);
            return;
        }

        try {
            const timestamp = Date.now().toString();
            const signature = crypto.randomBytes(32).toString('hex');
            payload.request_time = timestamp;

            const headers = {
                'signature': signature,
                'timestamp': timestamp,
                'content-type': 'application/x-www-form-urlencoded',
                'user-agent': 'okhttp/4.12.0',
            };

            const res = await axios.post(url, new URLSearchParams(payload), { headers, timeout: 45000 });
            const history = res.data.qris_history?.results?.[0];

            if (history) {
                const kredit = history.kredit?.trim();
                console.log(`[CHECK MUTASI] API Check: Menunggu ${formattedAmount}, Mutasi terbaru adalah ${kredit}`);
                if (kredit === formattedAmount) {
                    console.log(`[CHECK MUTASI] ✅ Pembayaran cocok ditemukan: ${kredit}`);
                    paymentConfirmed = true;
                }
            }
        } catch (err) {
            console.error("❌ Error saat cek mutasi:", err.message);
        }

        if (!paymentConfirmed) {
            await new Promise(res => setTimeout(res, 10000)); // Cek setiap 10 detik
            elapsed += 10;
        }
    }


    if (paymentConfirmed) {
        if (orderDetails.qrMessageKey) {
            try { await botInstance.sendMessage(senderJd, { delete: orderDetails.qrMessageKey }); } catch (e) {}
        }
        
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const product = await Produk.findById(orderDetails.productId).session(session);
            const variant = product.variants.get(orderDetails.variantId);
            variant.terjual = (variant.terjual || 0) + orderDetails.jumlah;
            product.markModified('variants');
            await product.save({ session });

            const snkProduk = variant.snk || "Tidak ada S&K khusus."; 
            const now = new Date();
            const tanggal = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
            const jam = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

            let successMsgUser = `╭───〔 *TRANSAKSI SUKSES* 🎉 〕\n\n• ID TRX: ${orderDetails.transactionId}\n\n╭──〔 *DETAIL PRODUCT* 📦〕 \n│ • Produk: ${orderDetails.productName} ${orderDetails.variantName}\n│ • Jumlah Beli: ${orderDetails.jumlah} \n│ • Total Bayar: Rp ${toRupiah(orderDetails.totalBayar)}\n│ • Tanggal: ${tanggal}\n│ • Jam: ${jam} WIB\n╰────────\n\n╭────〔 SNK PRODUCT 〕──\n\n${snkProduk}\n\n╰─────────\n\nDetail akun telah dikirim di pesan berikutnya.`;
            await botInstance.sendMessage(senderJd, { text: successMsgUser });

            const det = buildDetailBlock(orderDetails.reservedStock);
            await botInstance.sendMessage(senderJd, { text: det.text });

            // Kirim invoice gambar
            try {
                const invoiceBuffer = await generateInvoiceBuffer({
                    date: tanggal,
                    invoiceId: orderDetails.transactionId,
                    status: 'SUCCESS',
                    product: orderDetails.productName,
                    variant: orderDetails.variantName,
                    harga: toRupiah(orderDetails.totalBayar),
                    buyer: senderJd.split('@')[0],
                    sn: orderDetails.transactionId
                });
                await botInstance.sendMessage(senderJd, { image: invoiceBuffer, caption: 'INVOICE' });
            } catch (e) {
                console.error('Gagal membuat invoice:', e.message);
            }

            let accountsText = "";
            if (Array.isArray(orderDetails.reservedStock)) {
                orderDetails.reservedStock.forEach((item, index) => {
                    const [email, pass, twofa='-', profil='-', pin='-'] = item.split('|');
                    accountsText += `${index + 1}. ${email}\n   Password: ${pass}\n   2FA: ${twofa}\n   Profil: ${profil}\n   PIN: ${pin}\n\n`;
                });
            }
            
            const ownerToNotify = global.owner[0]; 
            if (ownerToNotify) {
                let ownerMsg = `🔔 *Ada Transaksi Berhasil* 🔔\n\nID TRX: ${orderDetails.transactionId}\n\n👤 Pembeli: ${orderDetails.pushname} | @${senderJd.split("@")[0]}\n📦 Produk: ${orderDetails.productName} ${orderDetails.variantName}\n💰 Total: Rp ${toRupiah(orderDetails.totalBayar)}\n🕒 Waktu: ${tanggal} | ${jam} WIB\n\nAkun Terkirim:\n${accountsText}`; 
                await botInstance.sendMessage(ownerToNotify.replace(/[^0-9]/g, '') + '@s.whatsapp.net', { text: ownerMsg, mentions: [senderJd] });
            }

            await saveTransactionRecord_Rap(senderJd.split('@')[0], orderDetails.pushname, orderDetails.productName, orderDetails.variantName, orderDetails.jumlah, orderDetails.hargaSatuanOriginal, orderDetails.hargaSetelahDiskon, orderDetails.feeAdmin, orderDetails.totalBayar);
            await PendingOrder.deleteOne({ userId: senderJd }).session(session);
            await session.commitTransaction();
            session.endSession();
        } catch (finalizationError) {
            await session.abortTransaction(); session.endSession();
            console.error(`[FATAL ERROR] Gagal finalisasi order:`, finalizationError);
            await PendingOrder.deleteOne({ userId: senderJd });
        }
    } else {
        const finalCheck = await PendingOrder.findOne({ userId: senderJd });
        if (finalCheck) {
            if (finalCheck.reservedStock && finalCheck.reservedStock.length > 0) {
                await Produk.updateOne({ _id: finalCheck.productId }, { $push: { [`variants.${finalCheck.variantId}.stok`]: { $each: finalCheck.reservedStock } } });
            }
            if (finalCheck.qrMessageKey) {
                try { await botInstance.sendMessage(senderJd, { delete: finalCheck.qrMessageKey }); } catch (e) {}
            }
            await botInstance.sendMessage(senderJd, { text: `Waktu pembayaran telah habis dan pesanan Anda dibatalkan.` });
            await PendingOrder.deleteOne({ userId: senderJd });
        }
    }
};


async function TelegraPh(imagePath) {
const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: "ddirzdaxp",
  api_key: "768934877945677",
  api_secret: "Kd00aYPWqpnolsTp9nllZHiCmj4",
});
  try {
    const result = await cloudinary.uploader.upload(imagePath, {});
    return result.secure_url;
  } catch (error) {
    console.error("Gagal upload:", error);
    throw error;
  }
}

function generateRandomText(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function runtime(seconds) {

    seconds = Number(seconds);

    var d = Math.floor(seconds / (3600 * 24));
    var h = Math.floor(seconds % (3600 * 24) / 3600);
    var m = Math.floor(seconds % 3600 / 60);
    var s = Math.floor(seconds % 60);
    var dDisplay = d > 0 ? d + (d == 1 ? " day, " : " days, ") : "";
    var hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
    var mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
    var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
    return dDisplay + hDisplay + mDisplay + sDisplay;
}
function toRupiah(angka) {
    if (typeof angka === 'undefined' || angka === null || isNaN(angka)) {
        return '0';
    }
    var saldo = '';
    var angkarev = angka.toString().split('').reverse().join('');
    for (var i = 0; i < angkarev.length; i++)
        if (i % 3 == 0) saldo += angkarev.substr(i, 3) + '.';
    return '' + saldo.split('', saldo.length - 1).reverse().join('');
}
// ====== AUTO FORMAT DETECTOR (VCC / DEFAULT) ======
function looksLikeVCC(parts) {
  const num = (parts[0] || '').replace(/\s|-/g, '').replace(/[oO]/g, '0');
  let exp = (parts[1] || '').trim().replace(/[oO]/g, '0');
  exp = exp.replace(/[-.]/g, '/');
  if (/^\d{4}$/.test(exp)) exp = exp.slice(0,2) + '/' + exp.slice(2);
  const cvv = (parts[2] || '').replace(/\s/g, '').replace(/[oO]/g, '0');

  const isCard = /^\d{13,19}$/.test(num);
  const isExp  = /^(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/.test(exp);
  const isCvv  = /^\d{3,4}$/.test(cvv);
  return isCard && isExp && isCvv;
}

function pickLabelsFromItem(rawLine) {
  const parts = (rawLine || '').split('|').map(s => (s ?? '').trim());
  if (looksLikeVCC(parts)) {
    return { type: 'vcc', labels: ['•', '•', '•', '•', '•'] };
  }
  return { type: 'default', labels: ['•', '•', '•', '•', '•'] };
}

function buildDetailBlock(items) {
  if (!items || items.length === 0) return '╭────〔 DETAIL AKUN 〕──\n( kosong )\n╰─────────\n';
  const det = pickLabelsFromItem(items[0]);
  const L = det.labels;
  let out = '╭────〔 DETAIL AKUN 〕──\n\n';
  items.forEach((item, i) => {
    const p = item.split('|').map(x => (x ?? '').trim());
    while (p.length < 5) p.push('');
    out += `• ${p[0]}\n`;
    out += `• ${p[1]}\n`;
    out += `• ${p[2]}\n`;
    out += `• ${p[3]}\n`;
    out += `• ${p[4]}\n\n`;
  });
  out += '╰─────────\n';
  return { text: out, headerLabels: L };
}

function msToDate(mse) {
               temp = mse
               days = Math.floor(mse / (24 * 60 * 60 * 1000));
               daysms = mse % (24 * 60 * 60 * 1000);
               hours = Math.floor((daysms) / (60 * 60 * 1000));
               hoursms = mse % (60 * 60 * 1000);
               minutes = Math.floor((hoursms) / (60 * 1000));
               minutesms = mse % (60 * 1000);
               sec = Math.floor((minutesms) / (1000));
               return days + " Days " + hours + " Hours " + minutes + " Minutes";
            }
            
const isUrl = (url) => {
    return url.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/, 'gi'))
}

async function UploadDulu(medianya, options = {}) {
const { ext } = await fromBuffer(medianya) || options.ext
        var form = new FormData()
        form.append('file', medianya, 'tmp.'+ext)
        let jsonnya = await fetch('https://tenaja.zeeoneofc.repl.co/upload', {
                method: 'POST',
                body: form
        })
        .then((response) => response.json())
        return jsonnya
}

const tanggal = (numer) => {
    myMonths = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    myDays = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']; 
    var tgl = new Date(numer);
    var day = tgl.getDate()
    bulan = tgl.getMonth()
    var thisDay = tgl.getDay(),
    thisDay = myDays[thisDay];
    var yy = tgl.getYear()
    var year = (yy < 1000) ? yy + 1900 : yy; 
    const time = moment.tz('Asia/Jakarta').format('DD/MM HH:mm:ss')
    let d = new Date
    let locale = 'id'
    let gmt = new Date(0).getTime() - new Date('1 January 1970').getTime()
    let weton = ['Pahing', 'Pon','Wage','Kliwon','Legi'][Math.floor(((d * 1) + gmt) / 84600000) % 5]
    
    return`${thisDay}, ${day} - ${myMonths[bulan]} - ${year}`
}

module.exports = arap = async (arap, m, chatUpdate, store, opengc, setpay, antilink, antiwame, antilink2, antiwame2, set_welcome_db, set_left_db, set_proses, set_done, set_open, set_close, sewa, _welcome, _left, db_respon_list) => {
    try {
        if (m.key.fromMe) return 
        var body = (m.mtype === 'conversation') ? m.message.conversation : (m.mtype == 'imageMessage') ? m.message.imageMessage.caption : (m.mtype == 'videoMessage') ? m.message.videoMessage.caption : (m.mtype == 'extendedTextMessage') ? m.message.extendedTextMessage.text : (m.mtype == 'buttonsResponseMessage') ? m.message.buttonsResponseMessage.selectedButtonId : (m.mtype == 'listResponseMessage') ? m.message.listResponseMessage.singleSelectReply.selectedRowId : (m.mtype == 'templateButtonReplyMessage') ? m.message.templateButtonReplyMessage.selectedId : (m.mtype === 'messageContextInfo') ? (m.message.buttonsResponseMessage?.selectedButtonId || m.message.listResponseMessage?.singleSelectReply.selectedRowId || m.text) : '' //omzee
        var budy = (typeof m.text == 'string' ? m.text : '')
        var prefix = prefa ? /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi.test(body) ? body.match(/^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi)[0] : "" : prefa ?? global.prefix
        const isCmd = body.startsWith(prefix)
        const command = body.replace(prefix, '').trim().split(/ +/).shift().toLowerCase()
        const args = body.trim().split(/ +/).slice(1)
        const pushname = m.pushName || "No Name"
        const botNumber = await arap.decodeJid(arap.user.id)
        const isCreator = ["6285760856305@s.whatsapp.net",botNumber, ...global.owner].map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(m.sender)
        const text = q = args.join(" ")
        const quoted = m.quoted ? m.quoted : m
        const mime = (quoted.msg || quoted).mimetype || ''
        const isMedia = /image|video|sticker|audio/.test(mime)
        const groupMetadata = m.isGroup ? await arap.groupMetadata(m.chat).catch(e => {}) : ''
        const groupName = m.isGroup ? groupMetadata.subject : ''
        const participants = m.isGroup ? await groupMetadata.participants : ''
        const groupAdmins = m.isGroup ? await getGroupAdmins(participants) : ''
        const isBotAdmins = m.isGroup ? groupAdmins.includes(botNumber) : false
        const isAdmins = m.isGroup ? groupAdmins.includes(m.sender) : false
        const isSewa = checkSewaGroup(m.chat, sewa)
        const isAntiLink = antilink.includes(m.chat) ? true : false
        const isAntiWame = antiwame.includes(m.chat) ? true : false  
        const isAntiLink2 = antilink2.includes(m.chat) ? true : false
        const isAntiWame2 = antiwame2.includes(m.chat) ? true : false  
const isWelcome = _welcome.includes(m.chat)
const isLeft = _left.includes(m.chat)
const jam = moment().format("HH:mm:ss z")
        const time = moment(Date.now()).tz('Asia/Jakarta').locale('id').format('HH:mm:ss z')
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

console.log(chalk.yellow(`[ INPUT USER ] ${m.pushName || m.sender.split('@')[0]} (${m.sender}): ${body || budy}`));

function getHargaSetelahDiskon(variant) {
  if (variant.discount && moment().isBefore(moment(variant.discount.expiresAt))) {
    return Math.floor(variant.price * (1 - variant.discount.percentage));
  }
  return variant.price;
}

const reply = async (teks) => {
  await arap.sendMessage(
    m.chat,
    {
      text: teks,
      contextInfo: {
        isForwarded: true,
        forwardingScore: 999,
        externalAdReply: {
          title: "BOT INFORMATION 🤖",
          body: "YZ-Creative | Digital Marketplace",
          mediaType: 1,
          thumbnailUrl: "https://raw.githubusercontent.com/agusrizal17/listproduk/refs/heads/main/Presentation_20250403_132226_0000.jpg",
          renderLargerThumbnail: true,
          sourceUrl: "https://whatsapp.com/channel/0029Van0wJd9WtCAp5fcpD0J" //ganti link grupny
        }
      }
    },
    { quoted: m }
  );
};


try {
    const userNomor = m.sender.split("@")[0];
    
    const existingUser = await User.findOne({ nomor: userNomor });

    if (!existingUser) {
        const newUser = new User({
            nomor: userNomor,
            nama: pushname,
            balance: 0,
            registeredAt: new Date()
        });
        
        await newUser.save();
        
        console.log(`[AUTO-REGISTER] Pengguna baru dicatat: ${userNomor} (${pushname})`);
        await reply(`Selamat datang, *${pushname}*! Nomor Anda otomatis terdaftar.`);
    }
} catch (autoRegError) {
    console.error("[AUTO-REGISTER] Error saat mencatat pengguna otomatis:", autoRegError);
}

async function getGcName(groupID) {
            try {
                let data_name = await arap.groupMetadata(groupID)
                return data_name.subject
            } catch (err) {
                return '-'
            }
        }
        if (m.message) {
            arap.readMessages([m.key])
        }
if(m.isGroup){
    expiredCheck(arap, sewa)
    }
        
      if (isAntiLink) {
        if (budy.match(`chat.whatsapp.com`)) {
        m.reply(`*「 ANTI LINK 」*\n\nLink grup detected, maaf kamu akan di kick !`)
        if (!isBotAdmins) return m.reply(`Upsss... gajadi, bot bukan admin`)
        let gclink = (`https://chat.whatsapp.com/`+await arap.groupInviteCode(m.chat))
        let isLinkThisGc = new RegExp(gclink, 'i')
        let isgclink = isLinkThisGc.test(m.text)
        if (isgclink) return m.reply(`Upsss... gak jadi, untung link gc sendiri`)
        if (isAdmins) return m.reply(`Upsss... gak jadi, kasian adminnya klo di kick`)
        if (isCreator) return m.reply(`Upsss... gak jadi, kasian owner ku klo di kick`)
        if (m.key.fromMe) return m.reply(`Upsss... gak jadi, kasian owner ku klo di kick`)
await arap.sendMessage(m.chat, {
                  delete: {
                  remoteJid: m.chat,
                  fromMe: false,
                  id: m.key.id,
                  participant: m.key.participant
               }
            })
        arap.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
        }
        }
        if (isAntiLink2) {
        if (budy.match(`chat.whatsapp.com`)) {
        if (!isBotAdmins) return //m.reply(`Upsss... gajadi, bot bukan admin`)
        let gclink = (`https://chat.whatsapp.com/`+await arap.groupInviteCode(m.chat))
        let isLinkThisGc = new RegExp(gclink, 'i')
        let isgclink = isLinkThisGc.test(m.text)
        if (isgclink) return //m.reply(`Upsss... gak jadi, untung link gc sendiri`)
        if (isAdmins) return //m.reply(`Upsss... gak jadi, kasian adminnya klo di kick`)
        if (isCreator) return //m.reply(`Upsss... gak jadi, kasian owner ku klo di kick`)
        if (m.key.fromMe) return //m.reply(`Upsss... gak jadi, kasian owner ku klo di kick`)
await arap.sendMessage(m.chat, {
               delete: {
                  remoteJid: m.chat,

                  fromMe: false,
                  id: m.key.id,
                  participant: m.key.participant
               }
            })
        }
        }
      if (isAntiWame) {
        if (budy.match(`wa.me/`)) {
        m.reply(`*「 ANTI WA ME 」*\n\nWa Me detected, maaf kamu akan di kick !`)
        if (!isBotAdmins) return m.reply(`Upsss... gajadi, bot bukan admin`)
        if (isAdmins) return m.reply(`Upsss... gak jadi, kasian adminnya klo di kick`)
        if (isCreator) return m.reply(`Upsss... gak jadi, kasian owner ku klo di kick`)
        if (m.key.fromMe) return m.reply(`Upsss... gak jadi, kasian owner ku klo di kick`)
await arap.sendMessage(m.chat, {
               delete: {
                  remoteJid: m.chat,

                  fromMe: false,
                  id: m.key.id,
                  participant: m.key.participant
               }
            })        
        arap.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
        }
        }
      if (isAntiWame2) {
        if (budy.match(`wa.me/`)) {
        if (!isBotAdmins) return //m.reply(`Upsss... gajadi, bot bukan admin`)
        if (isAdmins) return //m.reply(`Upsss... gak jadi, kasian adminnya klo di kick`)
        if (isCreator) return //m.reply(`Upsss... gak jadi, kasian owner ku klo di kick`)
        if (m.key.fromMe) return //m.reply(`Upsss... gak jadi, kasian owner ku klo di kick`)
await arap.sendMessage(m.chat, {
               delete: {
                  remoteJid: m.chat,

                  fromMe: false,
                  id: m.key.id,
                  participant: m.key.participant
               }
            })        
        }
        }
      if (isAntiWame) {
        if (budy.includes((`Wa.me/`) || (`Wa.me/`))) {
        m.reply(`*「 ANTI WA ME 」*\n\nWa Me detected, maaf kamu akan di kick !`)
        if (!isBotAdmins) return m.reply(`Upsss... gajadi, bot bukan admin`)
        if (isAdmins) return m.reply(`Upsss... gak jadi, kasian adminnya klo di kick`)
        if (isCreator) return m.reply(`Upsss... gak jadi, kasian owner ku klo di kick`)
        if (m.key.fromMe) return m.reply(`Upsss... gak jadi, kasian owner ku klo di kick`)
        arap.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
        }
        }
        
        if (isAlreadyResponList((m.isGroup ? m.chat: botNumber), body.toLowerCase(), db_respon_list)) {
            var get_data_respon = getDataResponList((m.isGroup ? m.chat: botNumber), body.toLowerCase(), db_respon_list)
            if (get_data_respon.isImage === false) {
                arap.sendMessage(m.chat, { text: sendResponList((m.isGroup ? m.chat: botNumber), body.toLowerCase(), db_respon_list) }, {
                    quoted: m
                })
            } else {
                arap.sendMessage(m.chat, { image: await getBuffer(get_data_respon.image_url), caption: get_data_respon.response }, {
                    quoted: m
                })
            }
        }
function Styles(text, style = 1) {
      var xStr = 'abcdefghijklmnopqrstuvwxyz1234567890'.split('');
      var yStr = Object.freeze({
        1: 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘqʀꜱᴛᴜᴠᴡxʏᴢ1234567890'
      });
      var replacer = [];
      xStr.map((v, i) => replacer.push({
        original: v,
        convert: yStr[style].split('')[i]
      }));
      var str = text.toLowerCase().split('');
      var output = [];
      str.map(v => {
        const find = replacer.find(x => x.original == v);
        find ? output.push(find.convert) : output.push(v);
      });
      return output.join('');
    }
        switch(command) {
          case 'menu': case 'help':{
            arap.sendMessage(m.chat, {image: pp_bot, caption: require("./settings").helpMenu(pushname)}, {quoted:m})
          }
          break
          case "mbayar": case 'tfgas': case 'tumbas':{
const getTextSetDone = (groupID, _db) => {
    let position = null
    Object.keys(_db).forEach((x) => {
        if (_db[x].id === groupID) {
            position = x
        }
    })
    if (position !== null) {
        return _db[position]
    }
}

let bentargwcekpaynya = await getTextSetDone(m.isGroup? m.chat: botNumber, setpay)
if (bentargwcekpaynya !== undefined) {
arap.sendMessage(m.chat, {image: await getBuffer(bentargwcekpaynya.pay), caption: bentargwcekpaynya.caption}, {quoted:m})
} else {
arap.sendMessage(m.chat, {image: qris, caption: caption_pay}, {quoted:m})
          }
          }
          break
               
case 'editstok': {
    if (!isCreator) return reply("Fitur ini khusus untuk Owner Bot!");

    const args = q.split("|");
    if (args.length < 2) {
        return reply(`❌ Format salah!\n\n*Untuk Edit 1 Baris:*\n${prefix}${command} IDVARIAN|NOMORURUT|DATABARU\nContoh: *${prefix}${command} ytfh|2|akunbaru@mail.com|passbaru*\n\n*Untuk Ganti Semua Stok:*\n${prefix}${command} ID_VARIAN|semua\nakun1|pass1\nakun2|pass2`);
    }

    const variantId = args[0].trim();
    const mode = args[1].trim().toLowerCase();

    try {
        let produkData = await loadProdukData_Rap();
        if (!produkData || Object.keys(produkData).length === 0) {
            return reply("⚠️ Terjadi kesalahan saat memuat data produk dari database. Coba lagi.");
        }

        let variantDataFound = null;
        let productName = "";
        let variantName = "";

        for (const pid in produkData) {
            if (produkData[pid].variants && produkData[pid].variants.get(variantId)) {
                variantDataFound = produkData[pid].variants.get(variantId);
                productName = produkData[pid].name || pid;
                variantName = variantDataFound.name || variantId;
                break;
            }
        }

        if (!variantDataFound) {
            return reply(`⚠️ Varian dengan ID *${variantId}* tidak ditemukan.`);
        }

        if (!isNaN(mode)) {
            const nomorUrut = parseInt(mode);
            if (nomorUrut <= 0) return reply("⚠️ Nomor urut harus angka positif lebih dari 0.");
            
            if (args.length < 3) return reply(`❌ Format salah! Data stok baru belum dimasukkan.\nContoh: *${prefix}${command} ${variantId}|${nomorUrut}|databarumail|databarupass*`);
            
            const dataStokBaru = args.slice(2).join("|").trim();

            const stokAkun = variantDataFound.stok;
            if (!stokAkun || !Array.isArray(stokAkun) || stokAkun.length === 0) {
                return reply(`📦 Varian *${variantName}* tidak memiliki stok untuk diedit.`);
            }

            const indexToEdit = nomorUrut - 1;
            if (indexToEdit < 0 || indexToEdit >= stokAkun.length) {
                return reply(`⚠️ Nomor urut *${nomorUrut}* tidak valid. Stok hanya tersedia dari nomor 1 sampai ${stokAkun.length}.`);
            }

            const stokLama = stokAkun[indexToEdit];
            stokAkun[indexToEdit] = dataStokBaru; 

            if (await saveProdukData_Rap(produkData)) {
                let teksBalasan = `✅ Stok berhasil di-edit untuk varian *${variantName}*.\n\n`;
                teksBalasan += `Nomor Urut: *${nomorUrut}*\n`;
                teksBalasan += `Data Lama: \`${stokLama}\`\n`;
                teksBalasan += `Data Baru: \`${dataStokBaru}\`\n\n`;
                teksBalasan += `Total stok untuk varian ini sekarang tetap *${stokAkun.length}* unit.`;
                return reply(teksBalasan);
            } else {
                stokAkun[indexToEdit] = stokLama; 
                return reply("⚠️ Gagal menyimpan perubahan data stok.");
            }
        } 
        
        else if (mode === 'semua') {
            const allNewStockText = q.substring(args[0].length + 1 + args[1].length).trim();
            if (!allNewStockText) {
                return reply(`❌ Format salah! Masukkan data stok baru setelah *semua*.\nContoh:\n${prefix}${command} ${variantId}|semua\nakun1|pass1\nakun2|pass2`);
            }

            const stokBaru = allNewStockText.split('\n').map(line => line.trim()).filter(Boolean);

            if (stokBaru.length === 0) {
                return reply("⚠️ Tidak ada data stok baru yang valid untuk menggantikan stok lama.");
            }

            const jumlahStokLama = variantDataFound.stok ? variantDataFound.stok.length : 0;
            variantDataFound.stok = stokBaru; 

            if (await saveProdukData_Rap(produkData)) {
                let teksBalasan = `✅ Seluruh stok untuk varian *${variantName}* berhasil diganti.\n\n`;
                teksBalasan += `Stok Lama: *${jumlahStokLama}* unit\n`;
                teksBalasan += `Stok Baru: *${stokBaru.length}* unit`;
                return reply(teksBalasan);
            } else {
                return reply("⚠️ Gagal menyimpan perubahan data stok. Coba lagi.");
            }
        } 
        
        else {
            return reply(`⚠️ Mode tidak dikenali: "${mode}".\nGunakan nomor urut (misal: 2) untuk mengedit satu baris, atau kata kunci "semua" untuk mengganti total stok.`);
        }
    } catch (err) {
        console.error("❌ Gagal mengupdate stok:", err);
        return reply("⚠️ Terjadi kesalahan saat memproses permintaan.");
    }
}
break;
            case 'dellist':{
         //   if (!m.isGroup) return m.reply('Fitur Khusus Group!')
            if (!(m.isGroup? isAdmins : isCreator)) return m.reply('Fitur Khusus Admin & Ustadz balz!')
            if (db_respon_list.length === 0) return m.reply(`Belum ada list message di database`)
            if (!text) return m.reply(`Gunakan dengan cara ${prefix + command} *key*\n\n_Contoh_\n\n${prefix + command} hello`)
            if (!isAlreadyResponList((m.isGroup? m.chat: botNumber), q.toLowerCase(), db_respon_list)) return m.reply(`Waduh, List Respon Dengan Kode *${q}* Tidak Ada Di Hatiku!`)
            delResponList((m.isGroup? m.chat: botNumber), q.toLowerCase(), db_respon_list)
            reply(`Sukses Menghapus Kenangan Dengan Kode *${q}*`)
            }
            break
case 'setmbayar': {
    if (!(m.isGroup ? isAdmins : isCreator)) return m.reply('Fitur Khusus Admin & Ustadz balz!')
    if (!text) return m.reply(`Reply payment dengan caption ${prefix + command} *caption*\n\n_Contoh_\n\n${prefix + command} Ini Kak Paymentnya`)
    if (!/image/.test(mime)) return m.reply(`Reply Payment Dengan Caption ${prefix + command} *caption*\n\n_Contoh_\n\n${prefix + command} Ini Kak Paymentnya`)
    
    let media = await arap.downloadAndSaveMediaMessage(quoted)
    let mem = await TelegraPh(media) // upload ke telegraph
    
    if (isAlreadyResponListGroup(m.isGroup ? m.chat : botNumber, setpay)) {
        updatePay(m.isGroup ? m.chat : botNumber, mem, text, setpay)
    } else {
        addPay(m.isGroup ? m.chat : botNumber, mem, text, setpay)
    }
    
    reply("Done Set Payment")
    
    if (fs.existsSync(media)) fs.unlinkSync(media)
}
break
case 'owner': {
    if (!global.owner || global.owner.length === 0) return reply("Owner belum diatur di file global.");
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${namaowner}\nORG:${namabot};\nTEL;type=CELL;type=VOICE;waid=${global.owner[0]}:${global.owner[0]}\nEND:VCARD`;
    await arap.sendMessage(m.chat, {
        contacts: {
            displayName: namaowner,
            contacts: [{ vcard }]
        }
    }, { quoted: m });
    reply(`Itu nomor owner ku ya kak~\n\nchat aja ya jangan malu malu.`);
}
break

case 'ffid': case 'freefirestalk': case 'ffstalk': {
            if (!text) return reply(`Contoh Penggunaan:\n${prefix + command} user id\n\nEx.\n${prefix + command} 7424606065`)
async function ffstalk(userId) {
  let data = {
    "voucherPricePoint.id": 8050,
    "voucherPricePoint.price": "",
    "voucherPricePoint.variablePrice": "",
    "email": "",
    "n": "",
    "userVariablePrice": "",
    "order.data.profile": "",
    "user.userId": userId,
    "voucherTypeName": "FREEFIRE",
    "affiliateTrackingId": "",
    "impactClickId": "",
    "checkoutId": "",
    "tmwAccessToken": "",
    "shopLang": "in_ID",
  }
  let ff = await axios({
    "headers": {
    "Content-Type": "application/json; charset\u003dutf-8"
    },
    "method": "POST",
    "url": "https://order.codashop.com/id/initPayment.action",
    "data": data
  })
  return {
    id: userId,
    nickname: ff.data["confirmationFields"]["roles"][0]["role"]
  }
}

var { id , nickname } = await ffstalk(args[0]).catch(async _ => await reply("User tidak di temukan"))
var vf = `*FREE FIRE STALK*

*ID: ${args[0]}*
*Nickname: ${nickname ? nickname : "Zeeoneofc"}*`
reply(vf)
         }
         break
         case 'mlid': case 'mobilelegendsstalk': case 'mlstalk': {
            if (!text) return reply(`Contoh penggunaan:\n${prefix + command} id|zona id\n\nEx.\n${prefix + command} 157228049|2241`)
 async function mlstalk(id, zoneId) {
    return new Promise(async (resolve, reject) => {
      axios
        .post(
          'https://api.duniagames.co.id/api/transaction/v1/top-up/inquiry/store',
          new URLSearchParams(
            Object.entries({
              productId: '1',
              itemId: '2',
              catalogId: '57',
              paymentId: '352',
              gameId: id,
              zoneId: zoneId,
              product_ref: 'REG',
              product_ref_denom: 'AE',
            })
          ),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Referer: 'https://www.duniagames.co.id/',
              Accept: 'application/json',
            },
          }
        )
        .then((response) => {
          resolve(response.data.data.gameDetail)
        })
        .catch((err) => {
          reject(err)
        })
    })
}

var { userName } = await mlstalk(text.split('|')[0], text.split('|')[1]).catch(async _ => await reply("User tidak di temukan"))
var vf = `*MOBILE LEGENDS STALK*

*ID: ${text.split('|')[0]}*
*ZONA ID: ${text.split('|')[1]}*
*Username: ${userName ? userName : "Zeeoneofc"}*`
reply(vf)
         }
         break
            case'addlist':{
          //  if (!m.isGroup) return m.reply('Fitur Khusus Group!')
            if (!(m.isGroup? isAdmins : isCreator)) return m.reply('Fitur Khusus Admin!')
            var args1 = q.split("|")[0].toLowerCase()
            var args2 = q.split("|")[1]
            if (!q.includes("|")) return m.reply(`Gunakan Dengan Cara ${command} *key|response*\n\n_Contoh_\n\n${command} tes|apa`)
            if (isAlreadyResponList((m.isGroup ? m.chat :botNumber), args1, db_respon_list)) return m.reply(`List Respon Dengan Kode : *${args1}* Sudah Ada Di Hatiku.`)
            if(m.isGroup){
            if (/image/.test(mime)) {
                let media = await arap.downloadAndSaveMediaMessage(quoted)
                let mem = await TelegraPh(media)
                        addResponList(m.chat, args1, args2, true, mem, db_respon_list)
                        reply(`Sukses Menambah Kenangan Dengan Kode : *${args1}*`)
                        if (fs.existsSync(media)) fs.unlinkSync(media)
            } else {
                addResponList(m.chat, args1, args2, false, '-', db_respon_list)
                reply(`Sukses Menambah Kenangan Dengan Kode : *${args1}*`)
            }
            } else {
            if (/image/.test(mime)) {
                let media = await arap.downloadAndSaveMediaMessage(quoted)
                let mem = await TelegraPh(media)
                        addResponList(botNumber, args1, args2, true, mem, db_respon_list)
                        reply(`Sukses Menambah Kenangan Dengan Kode : *${args1}*`)
                        if (fs.existsSync(media)) fs.unlinkSync(media)
            } else {
                addResponList(botNumber, args1, args2, false, '-', db_respon_list)
                reply(`Sukses Menambah Kenangan Dengan Kode : *${args1}*`)
            }
            }
            }
            break
case 'list': {
    const userNomor = m.sender.split("@")[0];
    const chatId = m.isGroup ? m.chat : botNumber;
    const chatName = m.isGroup ? groupName : "Chat Pribadi";

    if (db_respon_list.length === 0 || !isAlreadyResponListGroup(chatId, db_respon_list)) {
        return reply(`_Belum ada list apapun yang ditambahkan di ${chatName}._`);
    }

    const currentChatList = db_respon_list
        .filter(item => item.id === chatId)
        .sort((a, b) => a.key.localeCompare(b.key));

    if (currentChatList.length === 0) {
        return reply(`_Belum ada list apapun yang ditambahkan di ${chatName}._`);
    }
    
    let teks = ` Halo @${userNomor} 👋🏼\nBerikut daftar list yang tersedia di *${chatName}*:\n\n`;
    teks += `╭═┅═━━━━━━━━☉\n┊\n`;
    
    currentChatList.forEach((item, index) => {
        teks += `┊ *${index + 1}.* ${item.key.toUpperCase()}\n`;
    });

    teks += `┊\n╰═┅═━━━━━━━━☉\n\n`;
    teks += `Ketik nama list di atas untuk melihat detailnya.\n*Contoh: ${currentChatList[0].key}*`;

    arap.sendTextWithMentions(m.chat, teks, m);
}
break;
case 'setdesc': case 'setdesk': {
                if (!m.isGroup) return m.reply('Fitur Khusus Group!')
                if (!isAdmins) return m.reply('Fitur Khusus Admin!')
                if (!isBotAdmins) return m.reply("Jadikan *Bot* Sebagai Admin")
                if (!text) return m.reply(`Example ${prefix + command} WhatsApp Bot`)
                await arap.groupUpdateDescription(m.chat, text).then((res) => m.reply("Done")).catch((err) => m.reply("Terjadi kesalahan"))
            }
            break
case 'promote': {
        if (!m.isGroup) return m.reply('Fitur Khusus Group!')
                if (!isAdmins) return m.reply('Fitur Khusus Admin!')
                if (!isBotAdmins) return m.reply("Jadikan *Bot* Sebagai Admin")
        let users = m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : text.replace(/[^0-9]/g, '')+'@s.whatsapp.net'
        await arap.groupParticipantsUpdate(m.chat, [users], 'promote').then((res) => m.reply('Sukses Menaikkan Jabatan Member✅')).catch((err) => m.reply('❌ Terjadi Kesalahan'))
    }
    break
    case 'demote': {
        if (!m.isGroup) return m.reply('Fitur Khusus Group!')
                if (!isAdmins) return m.reply('Fitur Khusus Admin!')
                if (!isBotAdmins) return m.reply("Jadikan *Bot* Sebagai Admin")
        let users = m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : text.replace(/[^0-9]/g, '')+'@s.whatsapp.net'
        await arap.groupParticipantsUpdate(m.chat, [users], 'demote').then((res) => m.reply('Sukses Menurunkan Jabatan Admin✅')).catch((err) => m.reply('❌ Terjadi kesalahan'))
    }
    break
        
case "setlinkgc": case'revoke':{
            if (!m.isGroup) return m.reply('Fitur Khusus Group!')
                if (!isAdmins) return m.reply('Fitur Khusus Admin!')
                if (!isBotAdmins) return m.reply("Jadikan *Bot* Sebagai Admin")
            await arap.groupRevokeInvite(m.chat)
            .then( res => {
                reply(`Sukses Menyetel Tautan Undangan Grup Ini`)
            }).catch(() => reply("Terjadi Kesalahan"))
}
            break
case 'linkgrup': case 'linkgroup': case 'linkgc': {
                if (!m.isGroup) return m.reply('Fitur Khusus Group!')
                if (!isBotAdmins) return m.reply("Jadikan *Bot* Sebagai admin")
                let response = await arap.groupInviteCode(m.chat)
                m.reply(`https://chat.whatsapp.com/${response}\n\nLink Group : ${groupMetadata.subject}`)
            }
            break
case 'setppgroup': case 'setppgrup': case 'setppgc': {
                if (!m.isGroup) return m.reply('Fitur Khusus Group!')
                if (!isAdmins) return m.reply('Fitur Khusus Admin!')
                if (!isBotAdmins) return m.reply("Jadikan *Bot* Sebagai Admin")
                if (!quoted) return m.reply (`Kirim/Reply Image Dengan Caption ${prefix + command}`)
                if (!/image/.test(mime)) return m.reply (`Kirim/Reply Image Dengan Caption ${prefix + command}`)
                if (/webp/.test(mime)) return m.reply (`Kirim/Reply Image Dengan Caption ${prefix + command}`)
                let media = await arap.downloadAndSaveMediaMessage(quoted)
                await arap.updateProfilePicture(m.chat, { url: media }).catch((err) => fs.unlinkSync(media))
                m.reply("Berhasil Mengganti pp group")
                }
                break
         case 'setname':
         case 'setnamegc':
         case 'setsubject': {
           if (!m.isGroup) return m.reply('Fitur Khusus Group!')
                if (!isAdmins) return m.reply('Fitur Khusus Admin!')
                if (!isBotAdmins) return m.reply("Jadikan *Bot* Sebagai Admin")
            if (!text) return reply(`Contoh ${prefix+command} bot WhatsApp`)
            await arap.groupUpdateSubject(m.chat, text).then((res) => reply("Done")).catch((err) => reply("Terjadi Kesalahan"))
         }
         break
case 'bot':{
            var bot = `Iya Kakak, Ada Yang Bisa ${namabot} Bantu?\nKetik ${prefix}list untuk menampilkan list menu`
            const getTextB = getTextSetBot((m.isGroup? m.chat: botNumber), set_bot);
            if (getTextB !== undefined) {
                var pull_pesan = (getTextB.replace('@bot', namabot).replace('@owner', namaowner).replace('@jam', time).replace('@tanggal', tanggal(new Date())))
                arap.sendMessage(m.chat, { text: `${pull_pesan}` }, { quoted: m })
            } else {
                arap.sendMessage(m.chat, { text: bot }, { quoted: m })
            }
}
            break
        case "updatesetbot": case 'setbot': case 'changebot':{
            if (!(m.isGroup? isAdmins : isCreator)) return m.reply('Fitur Khusus admin & owner!')
            if (!q) return reply(`Gunakan dengan cara ${command} *teks_bot*\n\n_Contoh_\n\n${command} Halo saya adalah @bot\n\n@bot = nama bot\n@owner = nama owner\n@jam = jam\n@tanggal = tanggal`)
            if (isSetBot((m.isGroup? m.chat: botNumber), set_bot)) {
                changeSetBot(q, (m.isGroup? m.chat: botNumber), set_bot)
                reply(`Sukses update set bot teks!`)
            } else {
                addSetBot(q, (m.isGroup? m.chat: botNumber), set_bot)
                reply(`Sukses set teks bot!`)
            }
        }
            break
        case 'delsetbot':{
            if (!(m.isGroup? isAdmins : isCreator)) return m.reply('Fitur Khusus admin & owner!')
            if (!isSetBot((m.isGroup? m.chat: botNumber), set_bot)) return reply(`Belum ada set bot di chat ini`)
            removeSetBot((m.isGroup? m.chat: botNumber), set_bot)
            reply(`Sukses delete set bot`)
        }
            break
case 'rename':
            case 'renamelist': {
              if (!(m.isGroup? isAdmins : isCreator)) return m.reply('Fitur Khusus admin & owner!')
                    var args1 = q.split("|")[0].toLowerCase()
                    var args2 = q.split("|")[1]
                    if (!q.includes("|")) return m.reply(`Gunakan dengan cara ${prefix+command} *key|new key*\n\n_Contoh_\n\n${prefix+command} list dm|list dm baru`)
                    if (!isAlreadyResponList((m.isGroup? m.chat: botNumber), args1, db_respon_list)) return m.reply(`Maaf, untuk key *${args1}* belum terdaftar di chat ini`)
                    renameList((m.isGroup? m.chat: botNumber), args1, args2, db_respon_list)
                    reply(`*✅ Done*`)
            }
            break
            case 'updatelist': case 'update':{

            if (!(m.isGroup? isAdmins : isCreator)) return m.reply('Fitur Khusus admin & owner!')
            var args1 = q.split("|")[0].toLowerCase()
            var args2 = q.split("|")[1]
            if (!q.includes("|")) return m.reply(`Gunakan dengan cara ${command} *key|response*\n\n_Contoh_\n\n${command} tes|apa`)
            if (!isAlreadyResponList((m.isGroup? m.chat: botNumber), args1, db_respon_list)) return m.reply(`Maaf, untuk key *${args1}* belum terdaftar di chat ini`)
            if (/image/.test(mime)) {
                let media = await arap.downloadAndSaveMediaMessage(quoted)
                let mem = await TelegraPh(media)
                        updateResponList((m.isGroup? m.chat: botNumber), args1, args2, true, mem, db_respon_list)
                        reply(`Sukses update respon list dengan key *${args1}*`)
                        if (fs.existsSync(media)) fs.unlinkSync(media)
            } else {
                updateResponList((m.isGroup? m.chat: botNumber), args1, args2, false, '-', db_respon_list)
                reply(`Sukses update respon list dengan key *${args1}*`)
            }
            }
            break
case 'jeda': {
            if (!m.isGroup) return m.reply('Fitur Khusus Group!')
            if (!isAdmins) return m.reply('Fitur Khusus Admin!')
            if (!isBotAdmins) return m.reply("Jadikan *Bot* Sebagai Admin Terlebih Dahulu")
            if (!text) return m.reply(`kirim ${command} waktu\nContoh: ${command} 30m\n\nlist waktu:\ns = detik\nm = menit\nh = jam\nd = hari`)
            opengc[m.chat] = { id: m.chat, time: Date.now() + toMs(text) }
            fs.writeFileSync('./database/opengc.json', JSON.stringify(opengc))
            arap.groupSettingUpdate(m.chat, "announcement")
            .then((res) => reply(`Sukses, group akan dibuka ${text} lagi`))
            .catch((err) => reply('Error'))
            }
            break
case 'tambah':{
    if (!text.includes('+')) return m.reply(`Gunakan dengan cara ${command} *angka* + *angka*\n\n_Contoh_\n\n${command} 1+2`)
arg = args.join(' ')
atas = arg.split('+')[0]
bawah = arg.split('+')[1]
            var nilai_one = Number(atas)
            var nilai_two = Number(bawah)
            reply(`${nilai_one + nilai_two}`)}
            break
        case 'kurang':{
            if (!text.includes('-')) return m.reply(`Gunakan dengan cara ${command} *angka* - *angka*\n\n_Contoh_\n\n${command} 1-2`)
arg = args.join(' ')
atas = arg.split('-')[0]
bawah = arg.split('-')[1]
            var nilai_one = Number(atas)
            var nilai_two = Number(bawah)
            reply(`${nilai_one - nilai_two}`)}
            break
        case 'kali':{
            if (!text.includes('*')) return m.reply(`Gunakan dengan cara ${command} *angka* * *angka*\n\n_Contoh_\n\n${command} 1*2`)
arg = args.join(' ')
atas = arg.split('*')[0]
bawah = arg.split('*')[1]
            var nilai_one = Number(atas)
            var nilai_two = Number(bawah)
            reply(`${nilai_one * nilai_two}`)}
            break
        case 'bagi':{
            if (!text.includes('/')) return m.reply(`Gunakan dengan cara ${command} *angka* / *angka*\n\n_Contoh_\n\n${command} 1/2`)
arg = args.join(' ')
atas = arg.split('/')[0]
bawah = arg.split('/')[1]
            var nilai_one = Number(atas)
            var nilai_two = Number(bawah)
            reply(`${nilai_one / nilai_two}`)}
            break
        case 'setproses': case 'setp':{
        if (!(m.isGroup? isAdmins : isCreator)) return m.reply('Fitur Khusus admin!')
            if (!text) return m.reply(`Gunakan dengan cara ${prefix + command} *teks*\n\n_Contoh_\n\n${prefix + command} Pesanan sedang di proses ya @user\n\n- @user (tag org yg pesan)\n- @pesanan (pesanan)\n- @jam (waktu pemesanan)\n- @tanggal (tanggal pemesanan) `)
            if (isSetProses((m.isGroup? m.chat: botNumber), set_proses)) return m.reply(`Set proses already active`)
            addSetProses(text, (m.isGroup? m.chat: botNumber), set_proses)
            reply(`✅ Done set proses!`)
        }
            break
        case 'changeproses': case 'changep':{
        if (!(m.isGroup? isAdmins : isCreator)) return m.reply('Fitur Khusus admin!')
            if (!text) return m.reply(`Gunakan dengan cara ${prefix + command} *teks*\n\n_Contoh_\n\n${prefix + command} Pesanan sedang di proses ya @user\n\n- @user (tag org yg pesan)\n- @pesanan (pesanan)\n- @jam (waktu pemesanan)\n- @tanggal (tanggal pemesanan) `)
            if (isSetProses((m.isGroup? m.chat: botNumber), set_proses)) {
                changeSetProses(text, (m.isGroup? m.chat: botNumber), set_proses)
                m.reply(`Sukses ubah set proses!`)
            } else {
                addSetProses(text, (m.isGroup? m.chat: botNumber), set_proses)
                m.reply(`Sukses ubah set proses!`)
            }
        }
            break
        case 'delsetproses': case 'delsetp':{
        if (!(m.isGroup? isAdmins : isCreator)) return m.reply('Fitur Khusus admin!')
            if (!isSetProses((m.isGroup? m.chat: botNumber), set_proses)) return m.reply(`Belum ada set proses di gc ini`)
            removeSetProses((m.isGroup? m.chat: botNumber), set_proses)
            reply(`Sukses delete set proses`)
        }
            break
        case 'setdone':{
        if (!(m.isGroup? isAdmins : isCreator)) return m.reply('Fitur Khusus admin!')
            if (!text) return m.reply(`Gunakan dengan cara ${prefix + command} *teks*\n\n_Contoh_\n\n${prefix + command} Done @user\n\n- @user (tag org yg pesan)\n- @pesanan (pesanan)\n- @jam (waktu pemesanan)\n- @tanggal (tanggal pemesanan) `)
            if (isSetDone((m.isGroup? m.chat: botNumber), set_done)) return m.reply(`Udh set done sebelumnya`)
            addSetDone(text, (m.isGroup? m.chat: botNumber), set_done)
            reply(`Sukses set done!`)
            break
            }
           case 'changedone': case 'changed':{
        if (!(m.isGroup? isAdmins : isCreator)) return m.reply('Fitur Khusus admin!')
            if (!text) return m.reply(`Gunakan dengan cara ${prefix + command} *teks*\n\n_Contoh_\n\n${prefix + command} Done @user\n\n- @user (tag org yg pesan)\n- @pesanan (pesanan)\n- @jam (waktu pemesanan)\n- @tanggal (tanggal pemesanan) `)
            if (isSetDone((m.isGroup? m.chat: botNumber), set_done)) {
                changeSetDone(text, (m.isGroup? m.chat: botNumber), set_done)
                m.reply(`Sukses ubah set done!`)
            } else {
                addSetDone(text, (m.isGroup? m.chat: botNumber), set_done)
                m.reply(`Sukses ubah set done!`)
            }
           }
            break
        case 'delsetdone': case 'delsetd':{
        if (!(m.isGroup? isAdmins : isCreator)) return m.reply('Fitur Khusus admin!')
            if (!isSetDone((m.isGroup? m.chat: botNumber), set_done)) return m.reply(`Belum ada set done di gc ini`)
            removeSetDone((m.isGroup? m.chat: botNumber), set_done)
            m.reply(`Sukses delete set done`)
        }
            break
            case"p": case"proses":{
        if (!(m.isGroup? isAdmins : isCreator)) return m.reply('Fitur Khusus admin!')
            if (!m.quoted) return m.reply('Reply pesanan yang akan proses')
            let tek = m.quoted ? quoted.text : quoted.text.split(args[0])[1]
            let proses = `「 *TRANSAKSI PENDING* 」\n\n\`\`\`📆 TANGGAL : @tanggal\n⌚ JAM     : @jam\n✨ STATUS  : Pending\`\`\`\n\n📝 Catatan :\n@pesanan\n\nPesanan @user sedang di proses!`
            const getTextP = getTextSetProses((m.isGroup? m.chat: botNumber), set_proses);
            if (getTextP !== undefined) {
                var anunya = (getTextP.replace('@pesanan', tek ? tek : '-').replace('@user', '@' + m.quoted.sender.split("@")[0]).replace('@jam', time).replace('@tanggal', tanggal(new Date())).replace('@user', '@' + m.quoted.sender.split("@")[0]))
                arap.sendTextWithMentions(m.chat, anunya, m)
            } else {
   arap.sendTextWithMentions(m.chat, (proses.replace('@pesanan', tek ? tek : '-').replace('@user', '@' + m.quoted.sender.split("@")[0]).replace('@jam', time).replace('@tanggal', tanggal(new Date())).replace('@user', '@' + m.quoted.sender.split("@")[0])), m)
            }
            }
            break
            case "d": case'done':{
        if (!(m.isGroup? isAdmins : isCreator)) return m.reply('Fitur Khusus admin!')
            if (!m.quoted) return m.reply('Reply pesanan yang telah di proses')
            let tek = m.quoted ? quoted.text : quoted.text.split(args[0])[1]
            let sukses = `「 *TRANSAKSI BERHASIL* 」\n\n\`\`\`📆 TANGGAL : @tanggal\n⌚ JAM     : @jam\n✨ STATUS  : Berhasil\`\`\`\n\nTerimakasih @user Next Order ya🙏`            
            const getTextD = getTextSetDone((m.isGroup? m.chat: botNumber), set_done);
            if (getTextD !== undefined) {
                var anunya = (getTextD.replace('@pesanan', tek ? tek : '-').replace('@user', '@' + m.quoted.sender.split("@")[0]).replace('@jam', time).replace('@tanggal', tanggal(new Date())).replace('@user', '@' + m.quoted.sender.split("@")[0]))
                arap.sendTextWithMentions(m.chat, anunya, m)
               } else {
                arap.sendTextWithMentions(m.chat, (sukses.replace('@pesanan', tek ? tek : '-').replace('@user', '@' + m.quoted.sender.split("@")[0]).replace('@jam', time).replace('@tanggal', tanggal(new Date())).replace('@user', '@' + m.quoted.sender.split("@")[0])), m)
               }
   }
   break
            case'welcome':{
            if (!m.isGroup) return m.reply('Fitur Khusus Group!')
            if (!isAdmins) return m.reply('Fitur Khusus Admin!')
            if (args[0] === "on") {
               if (isWelcome) return m.reply(`Udah on`)
                _welcome.push(m.chat)
                fs.writeFileSync('./database/welcome.json', JSON.stringify(_welcome, null, 2))
                reply('Sukses mengaktifkan welcome di grup ini')
            } else if (args[0] === "off") {
               if (!isWelcome) return m.reply(`Udah off`)
                let anu = _welcome.indexOf(m.chat)
               _welcome.splice(anu, 1)
                fs.writeFileSync('./database/welcome.json', JSON.stringify(_welcome, null, 2))
                reply('Sukses menonaktifkan welcome di grup ini')
            } else {
                reply(`Kirim perintah ${prefix + command} on/off\n\nContoh: ${prefix + command} on`)
            }
            }
            break
        case'left': case 'goodbye':{
            if (!m.isGroup) return m.reply('Fitur Khusus Group!')
            if (!isAdmins) return m.reply('Fitur Khusus admin!')
            if (args[0] === "on") {
               if (isLeft) return m.reply(`Udah on`)
                _left.push(m.chat)
                fs.writeFileSync('./database/left.json', JSON.stringify(_left, null, 2))
                reply('Sukses mengaktifkan goodbye di grup ini')
            } else if (args[0] === "off") {
               if (!isLeft) return m.reply(`Udah off`)
                let anu = _left.indexOf(m.chat)
               _left.splice(anu, 1)
                fs.writeFileSync('./database/welcome.json', JSON.stringify(_left, null, 2))
                reply('Sukses menonaktifkan goodbye di grup ini')
            } else {
                reply(`Kirim perintah ${prefix + command} on/off\n\nContoh: ${prefix + command} on`)
            }
        }
            break
            case'setwelcome':{
            if (!m.isGroup) return m.reply('Fitur Khusus Group!')
            if (!isCreator && !isAdmins) return m.reply('Fitur Khusus owner!')
            if (!text) return m.reply(`Gunakan dengan cara ${command} *teks_welcome*\n\n_Contoh_\n\n${command} Halo @user, Selamat datang di @group`)
            if (isSetWelcome(m.chat, set_welcome_db)) return m.reply(`Set welcome already active`)
            addSetWelcome(text, m.chat, set_welcome_db)
           reply(`Successfully set welcome!`)
            }
            break
        case'changewelcome':{
            if (!m.isGroup) return m.reply('Fitur Khusus Group!')
            if (!isCreator && !isAdmins) return m.reply('Fitur Khusus owner!')
            if (!text) return m.reply(`Gunakan dengan cara ${command} *teks_welcome*\n\n_Contoh_\n\n${command} Halo @user, Selamat datang di @group`)
            if (isSetWelcome(m.chat, set_welcome_db)) {
               changeSetWelcome(q, m.chat, set_welcome_db)
                reply(`Sukses change set welcome teks!`)
            } else {
              addSetWelcome(q, m.chat, set_welcome_db)
                reply(`Sukses change set welcome teks!`)
            }}
            break
        case'delsetwelcome':{
            if (!m.isGroup) return m.reply('Fitur Khusus Group!')
            if (!isCreator && !isAdmins) return m.reply('Fitur Khusus owner!')
            if (!isSetWelcome(m.chat, set_welcome_db)) return m.reply(`Belum ada set welcome di sini..`)
            removeSetWelcome(m.chat, set_welcome_db)
           reply(`Sukses delete set welcome`)
        }
            break
        case'setleft':{
            if (!m.isGroup) return m.reply('Fitur Khusus Group!')
            if (!isCreator && !isAdmins) return m.reply('Fitur Khusus owner!')
            if (!text) return m.reply(`Gunakan dengan cara ${prefix + command} *teks_left*\n\n_Contoh_\n\n${prefix + command} Halo @user, Selamat tinggal dari @group`)
            if (isSetLeft(m.chat, set_left_db)) return m.reply(`Set left already active`)
           addSetLeft(q, m.chat, set_left_db)
            reply(`Successfully set left!`)
        }
            break
        case'changeleft':{
            if (!m.isGroup) return m.reply('Fitur Khusus Group!')
            if (!isCreator && !isAdmins) return m.reply('Fitur Khusus owner!')
            if (!text) return m.reply(`Gunakan dengan cara ${prefix + command} *teks_left*\n\n_Contoh_\n\n${prefix + command} Halo @user, Selamat tinggal dari @group`)
            if (isSetLeft(m.chat, set_left_db)) {
               changeSetLeft(q, m.chat, set_left_db)
                reply(`Sukses change set left teks!`)
            } else {
                addSetLeft(q, m.chat, set_left_db)
                reply(`Sukses change set left teks!`)
            }
        }
            break
        case'delsetleft':{
            if (!m.isGroup) return m.reply('Fitur Khusus Group!')
            if (!isCreator && !isAdmins) return m.reply('Fitur Khusus owner!')
            if (!isSetLeft(m.chat, set_left_db)) return m.reply(`Belum ada set left di sini..`)
            removeSetLeft(m.chat, set_left_db)
            reply(`Sukses delete set left`)
        }
            break
case'antiwame':{
            if (!m.isGroup) return m.reply('Fitur Khusus Group!')
                if (!isAdmins) return m.reply('Fitur Khusus admin!')
                if (!isBotAdmins) return m.reply("Jadikan *Bot* sebagai admin terlebih dahulu")
             if (args[0] === "on") {
                if (isAntiWame) return m.reply(`Udah aktif`)
                antiwame.push(m.chat)
                fs.writeFileSync('./database/antiwame.json', JSON.stringify(antiwame, null, 2))
                reply('Successfully Activate Antiwame In This Group')
            } else if (args[0] === "off") {
                if (!isAntiWame) return m.reply(`Udah nonaktif`)
                let anu = antiwame.indexOf(m.chat)
                antiwame.splice(anu, 1)
                fs.writeFileSync('./database/antiwame.json', JSON.stringify(antiwame, null, 2))
                reply('Successfully Disabling Antiwame In This Group')
            } else {
                reply(`Kirim perintah ${prefix + command} on/off\n\nContoh: ${prefix + command} on`)
            }
}
            break
case'antiwame2':{
            if (!m.isGroup) return m.reply('Fitur Khusus Group!')
                if (!isAdmins) return m.reply('Fitur Khusus admin!')
                if (!isBotAdmins) return m.reply("Jadikan bot sebagai admin terlebih dahulu")
             if (args[0] === "on") {
                if (isAntiWame2) return m.reply(`Udah aktif`)
                antiwame2.push(m.chat)
                fs.writeFileSync('./database/antiwame2.json', JSON.stringify(antiwame2, null, 2))
                reply('Successfully Activate antiwame2 In This Group')
            } else if (args[0] === "off") {
                if (!isAntiWame2) return m.reply(`Udah nonaktif`)
                let anu = antiwame2.indexOf(m.chat)
                antiwame2.splice(anu, 1)
                fs.writeFileSync('./database/antiwame2.json', JSON.stringify(antiwame2, null, 2))
                reply('Successfully Disabling antiwame2 In This Group')
            } else {
                reply(`Kirim perintah ${prefix + command} on/off\n\nContoh: ${prefix + command} on`)
            }
}
            break
           case'addsewa':{
            if (!isCreator) return m.reply("Fitur khusus owner!")
            if (text < 2) return m.reply(`Gunakan dengan cara ${prefix + command} *linkgc waktu*\n\nContoh : ${command} https://chat.whatsapp.com/JanPqlaMLa 30d\n\n*CATATAN:*\nd = hari (day)\nm = menit(minute)\ns = detik (second)\ny = tahun (year)\nh = jam (hour)`)
            if (!isUrl(args[0])) return m.reply("Link grup wa gk gitu modelnya cuy")
            var url = args[0]
            url = url.split('https://chat.whatsapp.com/')[1]
            if (!args[1]) return m.reply(`Waktunya?`)
            var data = await arap.groupAcceptInvite(url)
            if(checkSewaGroup(data, sewa)) return m.reply(`Bot sudah disewa oleh grup tersebut!`)
            addSewaGroup(data, args[1], sewa)
            reply(`Success Add Sewa Group Berwaktu!`)
           }
            break
            case'delsewa':{
            if (!isCreator) return m.reply("Fitur khusus owner!")
            if (!m.isGroup) return m.reply(`Perintah ini hanya bisa dilakukan di Grup yang menyewa bot`)
            if (!isSewa) return m.reply(`Bot tidak disewa di Grup ini`)
            sewa.splice(getSewaPosition(m.chat, sewa), 1)
            fs.writeFileSync('./database/sewa.json', JSON.stringify(sewa, null, 2))
            reply(`Sukses del sewa di grup ini`)
            }
            break
        case 'ceksewa': case 'listsewa':{
            let list_sewa_list = `*LIST SEWA*\n\n*Total:* ${sewa.length}\n\n`
            let data_array = [];
            for (let x of sewa) {
                list_sewa_list += `*Name:* ${await getGcName(x.id)}\n*ID :* ${x.id}\n`
                if (x.expired === 'PERMANENT') {
                    let ceksewa = 'PERMANENT'
                    list_sewa_list += `*Expire :* PERMANENT\n\n`
                } else {
                    let ceksewa = x.expired - Date.now()
                    list_sewa_list += `*Expired :* ${msToDate(ceksewa)}\n\n`
                }
            }
            arap.sendMessage(m.chat, { text: list_sewa_list }, { quoted: m })
        }
            break
            case'open': case'buka':{
            if (!m.isGroup) return m.reply('Fitur Khusus Group!')
                if (!isAdmins) return m.reply('Fitur Khusus Dewa!')
                if (!isBotAdmins) return m.reply("Bot Bukan Dewa")
           arap.groupSettingUpdate(m.chat, 'not_announcement')
            const textOpen = await getTextSetOpen(m.chat, set_open);
            reply(textOpen || `_Sukses Membuka 🔓 Grup Ini.._`)
            }
            break
case'antilink':{
            if (!m.isGroup) return m.reply('Fitur Khusus Group!')
                if (!isAdmins) return m.reply('Fitur Khusus admin!')
                if (!isBotAdmins) return m.reply("Bot harus menjadi admin")
            if (args[0] === "on") {
               if (isAntiLink) return m.reply(`Udah aktif`)
                antilink.push(m.chat)
                fs.writeFileSync('./database/antilink.json', JSON.stringify(antilink, null, 2))
                reply('Successfully Activate Antilink In This Group')
            } else if (args[0] === "off") {
               if (!isAntiLink) return m.reply(`Udah nonaktif`)
                let anu = antilink.indexOf(m.chat)
                antilink.splice(anu, 1)
                fs.writeFileSync('./database/antilink.json', JSON.stringify(antilink, null, 2))
                reply('Successfully Disabling Antilink In This Group')
            } else {
                reply(`Kirim perintah ${prefix + command} on/off\n\nContoh: ${prefix + command} on`)
            }
  
}
            break
case'antipoke':{
            if (!m.isGroup) return m.reply('Fitur Khusus Group!')
                if (!isAdmins) return m.reply('Fitur Khusus Para Dewa!')
                if (!isBotAdmins) return m.reply("Bot Harus Menjadi Dewa")
            if (args[0] === "on") {
               if (isAntiLink2) return m.reply(`Udah Aktif`)
                antilink2.push(m.chat)
                fs.writeFileSync('./database/antilink2.json', JSON.stringify(antilink2, null, 2))
                reply('Sukses Mengaktifkan *Anti Poke* Di Grup Ini!')
            } else if (args[0] === "off") {
               if (!isAntiLink2) return m.reply(`Udah Nonaktif`)
                let anu = antilink2.indexOf(m.chat)
                antilink2.splice(anu, 1)
                fs.writeFileSync('./database/antilink2.json', JSON.stringify(antilink2, null, 2))
                reply('Sukses Menonaktifkan *Anti Poke* Di Grup Ini!')
            } else {
                reply(`Kirim perintah ${prefix + command} on/off\n\nContoh: ${prefix + command} on`)
            }
  
}
            break
case'close': case'tutup':{
            if (!m.isGroup) return m.reply('Fitur Khusus Group!')
                if (!isAdmins) return m.reply('Fitur Khusus admin!')
                if (!isBotAdmins) return m.reply("Bot bukan admin")
        arap.groupSettingUpdate(m.chat, 'announcement')
            const textClose = await getTextSetClose(m.chat, set_close);
            reply(textClose || `_Sukses Menutup 🔒 Grup Ini.._`)
}
            break
         case 'h':
         case 'woy':
         case 'hidetag':{
            if (!m.isGroup) return reply("Khusus Grup")
            if (!(isAdmins || isCreator)) return reply("Fitur Khusus Para Dewa")
   let tek = m.quoted ? quoted.text : (text ? text : "")
            arap.sendMessage(m.chat, {
               text: tek ,
               mentions: participants.map(a => a.id)
            }, {
            })
         }
            break
         
         case 'sgif':
         case 'stikerin':
         case 's':
         case 'sticker':
         case 'stiker': {
           if (!quoted) return reply(`Reply foto/video dengan caption ${prefix + command}\n\ndurasi video maks 1-9 detik`)
            if (/image/.test(mime)) {
               let media = await quoted.download()
               let encmedia = await arap.sendImageAsSticker(m.chat, media, m, {
                  packname: global.namabot,
                  author: global.namaowner
               })
               await fs.unlinkSync(encmedia)
            } else if (/video/.test(mime)) {
               if ((quoted.msg || quoted).seconds > 11) return reply(`Reply foto/video dengan caption ${prefix + command}\n\ndurasi video maks 1-9 detik`)
               let media = await quoted.download()
               let encmedia = await arap.sendVideoAsSticker(m.chat, media, m, {
                  packname: global.namabot,
                  author: global.namaowner
               })
               await fs.unlinkSync(encmedia)
            } else {
               reply(`Reply foto/video dengan caption ${prefix + command}\n\ndurasi video maks 1-9 detik`)
            }
 
         }
         break
            case 'kick': {
                if (!m.isGroup) return m.reply('Fitur Khusus Group!')
                if (!isAdmins) return m.reply('Fitur Khusus admin!')
                if (!isBotAdmins) return m.reply('Fitur Khusus admin!')
        let users = m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted ? m.quoted.sender : text.replace(/[^0-9]/g, '')+'@s.whatsapp.net'
        await arap.groupParticipantsUpdate(m.chat, [users], 'remove').then((res) => m.reply('Sukses kick target✅')).catch((err) => m.reply('❌ Terjadi kesalahan'))
    }
    break
    case 'add': {
        if (!m.isGroup) return m.reply('Fitur Khusus Group!')
                if (!isAdmins) return m.reply('Fitur Khusus admin!')
                if (!isBotAdmins) return m.reply('Fitur Khusus admin!')
        let users = m.quoted ? m.quoted.sender : text.replace(/[^0-9]/g, '')+'@s.whatsapp.net'
        await arap.groupParticipantsUpdate(m.chat, [users], 'add').then((res) => m.reply('Sukses add member✅')).catch((err) => m.reply('❌ Terjadi kesalahan, mungkin nmr nya privat'))
    }
    break
case 'ping':{
  m.reply(runtime(process.uptime()))
}
break 
case 'listkode': {
    try {

        const allProducts = await Produk.find({})
            .select('id name')
            .sort({ name: 'asc' }); 


        if (!allProducts || allProducts.length === 0) {
            return reply("📦 Belum ada produk yang tersedia di database.");
        }

        let teks = "╭───〔 *DAFTAR KODE PRODUK* 〕\n";
        teks += "│\n";


        allProducts.forEach((produk, index) => {
            teks += `│ ${index + 1}. *${produk.name || 'Tanpa Nama'}*\n`;
            teks += `│    └─ Kode: *${produk.id}*\n`;
        });
        teks += "│\n";
        teks += "╰─────────────────\n\n";
        teks += "Gunakan *kode* di atas untuk melihat detail atau melakukan pembelian.";

        reply(teks);

    } catch (err) {
        console.error("[LISTKODE] Error saat mengambil data produk dari MongoDB:", err);
        reply("⚠️ Terjadi kesalahan saat mencoba mengambil daftar kode produk.");
    }
}
break;
case 'restok':
case 'notifrestok': {
    const variantId = q.trim();
    if (!variantId) {
        return reply(`❌ Format salah! Masukkan Code Variant yang ingin Anda tunggu.\nContoh: *${prefix + command} CODE_VARIAN*`);
    }


    let produkData = await loadProdukData_Rap();
    if (!produkData) {
        return reply("⚠️ Terjadi kesalahan saat memuat data produk. Coba lagi nanti.");
    }

    let variantDataFound = null;
    let productName = "";
    let variantName = "";


    for (const pid in produkData) {
        if (produkData[pid].variants && produkData[pid].variants.get(variantId)) {
            variantDataFound = produkData[pid].variants.get(variantId);
            productName = produkData[pid].name;
            variantName = variantDataFound.name;
            break;
        }
    }

    if (!variantDataFound) {
        return reply(`⚠️ Varian dengan CODE *${variantId}* tidak ditemukan.`);
    }

    const stokTersedia = variantDataFound.stok ? variantDataFound.stok.length : 0;
    if (stokTersedia > 0) {
        return reply(`✅ Info: Produk *${productName}* *${variantName}* saat ini sudah tersedia\n\nJumlah Stok: ${stokTersedia}\n\nAnda bisa langsung order dengan ketik:\n*${prefix}buynow ${variantId} jumlah*`);
    }


    if (isRestockSubscriber(variantId, m.sender)) {
        return reply(`🔔 Anda sudah terdaftar untuk notifikasi restock varian *${productName}* *${variantName}.*\n\nKami akan memberitahu Anda jika stok sudah tersedia!`);
    }



    if (addRestockSubscriber(variantId, m.sender)) {
        reply(`🔔 Selamat anda telah terdaftar untuk notifikasi restock varian *${productName}* *${variantName}.*\n\nKami akan memberitahu Anda jika stok sudah tersedia!`);
    } else {
        reply("⚠️ Gagal mendaftar notifikasi. Silakan coba lagi.");
    }
}
break;
case 'profitharian': {
    if (!isCreator) return reply("Fitur ini khusus untuk Owner Bot!");

    try {
        const todayStart = moment().startOf('day').toDate();
        const todayEnd = moment().endOf('day').toDate();

        const transactionsToday = await Transaction.find({
            timestamp: { $gte: todayStart, $lte: todayEnd }
        });

        if (transactionsToday.length === 0) {
            return reply(`Belum ada transaksi untuk hari ini (${moment().format('DD MMMM YYYY')}).`);
        }

        const totalPenjualanHariIni = transactionsToday.reduce((acc, trx) => acc + trx.totalAmountPaid, 0);

        let teks = `📊 *PENJUALAN HARI INI* 📊\n`;
        teks += `(${moment().format('DD MMMM YYYY')})\n\n`;
        teks += `📦 Total Transaksi: *${transactionsToday.length}*\n`;
        teks += `💰 Total Penjualan: *Rp ${toRupiah(totalPenjualanHariIni)}*\n\n`;
        teks += `-----------------------------------\n`;
        teks += `📋 *Detail Transaksi Hari Ini:*\n`;

        transactionsToday.forEach((trx, i) => {
            teks += `${i + 1}. 🕒 ${moment(trx.timestamp).tz('Asia/Jakarta').format('HH:mm:ss')}\n`;
            teks += `   👤 Pembeli: ${trx.userName}\n`;
            teks += `   🛍️ Produk: ${trx.productName}${trx.variantName !== '-' ? ' - ' + trx.variantName : ''}\n`;
            teks += `   🔢 Jumlah: ${trx.quantity}\n`;
            teks += `   💲 Total: Rp ${toRupiah(trx.totalAmountPaid)}\n\n`;
        });
        reply(teks);

    } catch (err) {
        console.error("❌ Gagal memuat profit harian dari MongoDB:", err);
        return reply("⚠️ Terjadi kesalahan saat memuat data profit.");
    }
}
break;

case 'profitmingguan': {
    if (!isCreator) return reply("Fitur ini khusus untuk Owner Bot!");

    try {
        const startOfWeek = moment().startOf('week').toDate();
        const endOfWeek = moment().endOf('week').toDate();
        
        const transactionsThisWeek = await Transaction.find({
            timestamp: { $gte: startOfWeek, $lte: endOfWeek }
        }).sort({ timestamp: 1 });

        if (transactionsThisWeek.length === 0) {
            return reply(`Belum ada transaksi untuk minggu ini (${moment(startOfWeek).format('DD MMM')} - ${moment(endOfWeek).format('DD MMM YYYY')}).`);
        }
        
        const totalPenjualanMingguIni = transactionsThisWeek.reduce((acc, trx) => acc + trx.totalAmountPaid, 0);
        let penjualanPerHari = {};
        transactionsThisWeek.forEach(trx => {
            const tanggalTransaksi = moment(trx.timestamp).tz('Asia/Jakarta').format('YYYY-MM-DD');
            penjualanPerHari[tanggalTransaksi] = (penjualanPerHari[tanggalTransaksi] || 0) + trx.totalAmountPaid;
        });

        let teks = `📅 *REKAP PENJUALAN MINGGUAN* 📅\n`;
        teks += `(${moment(startOfWeek).format('DD MMMM')} - ${moment(endOfWeek).format('DD MMMM YYYY')})\n\n`;
        teks += `📦 Total Transaksi: *${transactionsThisWeek.length}*\n`;
        teks += `💰 Total Omzet Minggu Ini: *Rp ${toRupiah(totalPenjualanMingguIni)}*\n\n`;
        teks += `-----------------------------------\n`;
        teks += `📈 *Rincian Per Hari:*\n`;
        const sortedDates = Object.keys(penjualanPerHari).sort();
        for (const tanggal of sortedDates) {
            teks += `   - ${moment(tanggal).format('dddd, DD MMM')}: Rp ${toRupiah(penjualanPerHari[tanggal])}\n`;
        }
        reply(teks);

    } catch (err) {
        console.error("❌ Gagal memuat profit mingguan dari MongoDB:", err);
        return reply("⚠️ Terjadi kesalahan saat memuat data profit.");
    }
}
break;

case 'profitbulanan': {
    if (!isCreator) return reply("Fitur ini khusus untuk Owner Bot!");

    try {
        const startOfMonth = moment().startOf('month').toDate();
        const endOfMonth = moment().endOf('month').toDate();
        
        const transactionsThisMonth = await Transaction.find({
            timestamp: { $gte: startOfMonth, $lte: endOfMonth }
        }).sort({ timestamp: 1 });

        if (transactionsThisMonth.length === 0) {
            return reply(`Belum ada transaksi untuk bulan ini (${moment().format('MMMM YYYY')}).`);
        }
        
        const totalPenjualanBulanIni = transactionsThisMonth.reduce((acc, trx) => acc + trx.totalAmountPaid, 0);
        let penjualanPerHariBulan = {};
        transactionsThisMonth.forEach(trx => {
            const tanggalTransaksi = moment(trx.timestamp).tz('Asia/Jakarta').format('YYYY-MM-DD');
            penjualanPerHariBulan[tanggalTransaksi] = (penjualanPerHariBulan[tanggalTransaksi] || 0) + trx.totalAmountPaid;
        });

        let teks = `🗓️ *REKAP PENJUALAN BULANAN* 🗓️\n`;
        teks += `(${moment().format('MMMM YYYY')})\n\n`;
        teks += `📦 Total Transaksi: *${transactionsThisMonth.length}*\n`;
        teks += `💰 Total Omzet Bulan Ini: *Rp ${toRupiah(totalPenjualanBulanIni)}*\n\n`;
        teks += `-----------------------------------\n`;
        teks += `📈 *Rincian Per Hari:*\n`;
        const sortedDates = Object.keys(penjualanPerHariBulan).sort();
        for (const tanggal of sortedDates) {
            teks += `   - ${moment(tanggal).format('DD MMM')}: Rp ${toRupiah(penjualanPerHariBulan[tanggal])}\n`;
        }
        reply(teks);

    } catch (err) {
        console.error("❌ Gagal memuat profit bulanan dari MongoDB:", err);
        return reply("⚠️ Terjadi kesalahan saat memuat data profit.");
    }
}
break;

case 'profit':
case 'totalprofit':
case 'totalpenjualan': {
    if (!isCreator) return reply("Fitur ini khusus untuk Owner Bot!");

    try {
        const allTransactions = await Transaction.find({});

        if (allTransactions.length === 0) {
            return reply('📖 Belum ada transaksi yang tercatat untuk dihitung.');
        }

        const totalKeseluruhanPenjualan = allTransactions.reduce((acc, trx) => acc + trx.totalAmountPaid, 0);
        
        const firstTransaction = allTransactions[0];
        const lastTransaction = allTransactions[allTransactions.length - 1];
        
        const tanggalMulai = moment(firstTransaction.timestamp).format('YYYY-MM-DD');
        const tanggalSelesai = moment(lastTransaction.timestamp).format('YYYY-MM-DD');

        let teks = `💰 *LAPORAN PROFIT KESELURUHAN* 💰\n\n`;
        teks += `Periode Data: *${moment(tanggalMulai).format('DD MMM YYYY')}* s/d *${moment(tanggalSelesai).format('DD MMM YYYY')}*\n`;
        teks += `-----------------------------------\n`;
        teks += `📦 Total Transaksi Tercatat: *${allTransactions.length} transaksi*\n`;
        teks += `📈 Total Estimasi Penjualan: *Rp ${toRupiah(totalKeseluruhanPenjualan)}*\n`;
        teks += `-----------------------------------\n\n`;
        teks += `Ini adalah total dari semua transaksi yang tercatat di database.`;

        reply(teks);

    } catch (err) {
        console.error("❌ Gagal memuat total profit dari MongoDB:", err);
        return reply("⚠️ Terjadi kesalahan saat memuat data profit.");
    }
}
break;

case 'addproduk': {
    if (!isCreator) return reply("Fitur Khusus Para Dewa");
    let data = q.split("|");
    if (!data[2]) return reply(`❌ Format salah!\nContoh: ${prefix + command} ID|Nama Produk|Deskripsi`);

    const id = data[0].trim();
    const name = data[1].trim();
    const desc = data[2].trim();

    try {
        const existingProduct = await Produk.findOne({ id: id });
        if (existingProduct) {
            return reply(`⚠️ Produk dengan ID *${id}* sudah ada.`);
        }
    } catch (err) {
        console.error("❌ Error saat mencari produk di MongoDB:", err);
        return reply("⚠️ Terjadi kesalahan saat memeriksa produk.");
    }

    const newProductData = {
        id: id,
        name: name,
        desc: desc,
        variants: {}
    };


    try {
        const newProduct = new Produk(newProductData);
        await newProduct.save();
        reply(`✅ Produk *${name}* berhasil ditambahkan!\n🔑 ID: ${id}\n🗒️ Deskripsi: ${desc}`);
    } catch (err) {
        console.error("❌ Gagal menambahkan produk ke MongoDB:", err);
        return reply(`⚠️ Gagal menambahkan produk. Coba lagi.`);
    }
}
break;
case 'delproduk': {
    if (!isCreator) return reply("Fitur khusus Owner!");

    let productId = q.trim();
    if (!productId) return reply(`❌ Format salah!\nContoh: ${prefix + command} ID_Produk`);

    try {

        const product = await Produk.findOne({ id: productId });
        if (!product) {
            return reply(`⚠️ Produk dengan ID *${productId}* tidak ditemukan.`);
        }
        
        const productName = product.name || productId;


        const result = await Produk.deleteOne({ id: productId });

        if (result.deletedCount > 0) {
            reply(`✅ Produk *${productName}* (ID: ${productId}) telah berhasil dihapus.`);
        } else {
            reply("⚠️ Gagal menghapus produk. Coba lagi.");
        }

    } catch (err) {
        console.error("❌ Gagal menghapus produk dari MongoDB:", err);
        return reply("⚠️ Terjadi kesalahan saat menghapus data produk.");
    }
}
break;
case 'addvariant': {
    if (!isCreator) return reply("Fitur Khusus Para Dewa");
    
    let data = q.split("|");
    if (!data[5]) return reply(`❌ Format salah!\nContoh: ${prefix + command} ID_Produk|VariantID|Nama Varian|Deskripsi|S&K|Harga`);

    let productId = data[0].trim();
    let variantId = data[1].trim();
    let variantName = data[2].trim();
    let variantDesc = data[3].trim();
    let snk = data[4].trim();
    let price = parseInt(data[5]);

    if (isNaN(price) || price < 0) {
        return reply("⚠️ Harga harus berupa angka positif.");
    }
    
    try {

        const product = await Produk.findOne({ id: productId });
        if (!product) {
            return reply(`⚠️ Produk dengan ID *${productId}* tidak ditemukan.`);
        }


        if (product.variants.get(variantId)) {
            return reply(`⚠️ Varian dengan ID *${variantId}* sudah ada di produk *${product.name}*.`);
        }

        const newVariantData = {
            id: variantId,
            name: variantName,
            desc: variantDesc,
            snk: snk,
            price: price,
            stok: [],
            terjual: 0
        };


        product.variants.set(variantId, newVariantData);
        await product.save();
        
        reply(`✅ Varian *${variantName}* (ID: ${variantId}) berhasil ditambahkan ke produk *${product.name}*!\n💰 Harga: Rp ${toRupiah(price)}\n📦 Stok: Belum ditambahkan`);

    } catch (err) {
        console.error("❌ Gagal menambahkan varian ke MongoDB:", err);
        return reply(`⚠️ Gagal menambahkan varian. Coba lagi.`);
    }
}
break;

case 'cekdataakun':
case 'getdatavariant': {
    if (!isCreator) return reply("Fitur ini khusus untuk Owner Bot!");

    const variantId = q.trim();
    if (!variantId) {
        return reply(`❌ Format salah! Masukkan ID Variant yang ingin dicek data akunnya.\nContoh: *${prefix + command} ID_VARIAN*`);
    }


    let produkData = await loadProdukData_Rap();
    if (!produkData || Object.keys(produkData).length === 0) {
        return reply("⚠️ Terjadi kesalahan saat memuat data produk. Silakan cek konsol server.");
    }

    let variantDataFound = null;
    let productName = "";
    let variantName = "";

    for (const pid in produkData) {
        if (produkData[pid].variants && produkData[pid].variants.get(variantId)) {
            variantDataFound = produkData[pid].variants.get(variantId);
            productName = produkData[pid].name || pid;
            variantName = variantDataFound.name || variantId;
            break;
        }
    }

    if (!variantDataFound) {
        return reply(`⚠️ Varian dengan ID *${variantId}* tidak ditemukan dalam produk manapun.`);
    }

    const stokAkun = variantDataFound.stok;

    if (!stokAkun || !Array.isArray(stokAkun) || stokAkun.length === 0) {
        return reply(`📦 Tidak ada data akun (stok) yang tersimpan untuk varian *${variantName}* (Produk: *${productName}*).`);
    }

    let teksBalasan = `📄 *DATA AKUN / STOK UNTUK VARIAN* 📄\n\n`;
    teksBalasan += `Produk: *${productName}*\n`;
    teksBalasan += `Varian: *${variantName}*\nCode variant: *${variantId}*)\n`;
    teksBalasan += `Jumlah Akun Tersedia: *${stokAkun.length}*\n\n`;
    teksBalasan += `-----------------------------------\n`;

    const maxDisplayItems = 50; 
    stokAkun.slice(0, maxDisplayItems).forEach((akunEntry, index) => {
        teksBalasan += `${index + 1}. ${akunEntry}\n`;
    });
    
    if (stokAkun.length > maxDisplayItems) {
        teksBalasan += `\n...dan ${stokAkun.length - maxDisplayItems} item lainnya.\n`;
        teksBalasan += `Gunakan *${prefix}getstok ${variantId} ${stokAkun.length}* untuk melihat semua stok dalam file.\n`;
    }

    teksBalasan += `-----------------------------------\n`;

    try {
        await reply(teksBalasan);
    } catch (e) {
        console.error("Gagal mengirim balasan panjang:", e);
        reply("⚠️ Data akun terlalu panjang untuk ditampilkan sekaligus. Silakan gunakan perintah *getstok* untuk melihat semua data dalam file.");
    }
}
break;
case 'getstok':
case 'orderadmin': {
    if (!isCreator) return reply("Fitur khusus Owner!");
    
    let argsSplit = q.split(" ");
    if (argsSplit.length < 2) {
        return reply(`❌ Format salah!\nContoh: ${prefix + command} ID_VARIAN Jumlah`);
    }

    const variantId = argsSplit[0].trim();
    const jumlah = parseInt(argsSplit[1]);

    if (isNaN(jumlah) || jumlah <= 0) {
        return reply("⚠️ Jumlah tidak valid. Harap masukkan angka positif.");
    }
    
    try {
        const product = await Produk.findOne({ [`variants.${variantId}.id`]: variantId });

        if (!product) {
            return reply(`⚠️ Varian dengan ID *${variantId}* tidak ditemukan.`);
        }

        const variant = product.variants.get(variantId);

        if (!variant || !Array.isArray(variant.stok) || variant.stok.length === 0) {
            return reply("⚠️ Stok varian ini sudah habis!");
        }

        if (variant.stok.length < jumlah) {
            return reply(`⚠️ Stok tersedia hanya ${variant.stok.length}, harap jumlah tidak melebihi stok.`);
        }

        const stokDiberikan = variant.stok.splice(0, jumlah);
        variant.terjual = (variant.terjual || 0) + jumlah;

        product.markModified('variants');
        
        await product.save();

        await reply("✅ Stok berhasil diambil\nCek detail stok di chat pribadi!");
        
        const tanggalSaatIni = moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss');
        
        let chatMessage = `╭───〔 *PRODUK BERHASIL DIAMBIL🎉* 〕\n\n`;
        chatMessage += `╭────〔 *PRODUCT DETAIL📦* 〕──\n`;
        chatMessage += `| • Nama Produk : ${product.name}\n`;
        chatMessage += `| • Varian : ${variant.name}\n`;
        chatMessage += `| • Jumlah Order : ${jumlah}\n`;
        chatMessage += `| • Tanggal : ${tanggalSaatIni}\n`;
        chatMessage += `╰─────────\n\n`;
        

        let akunListForFile = '';
        {
        const det = buildDetailBlock(stokDiberikan);
        chatMessage += det.text;
        // akunListForFile no longer used
    }

        chatMessage += `╰─────────\n\n`;
        chatMessage += `╭────〔 *SNK PRODUCT* 〕──\n\n`;
        chatMessage += `${variant.snk || 'Tidak ada S&K.'}\n\n╰─────────`;


        try {

            await arap.sendMessage(m.sender, { text: chatMessage }, { quoted: m });
            



        } catch (sendError) {
            console.error("❌ Gagal mengirim detail stok (teks atau file):", sendError);
            return reply("⚠️ Terjadi kesalahan saat mengirim detail stok. Silakan periksa kembali pesan Anda.");
        }

    } catch (err) {
        console.error("❌ Gagal mengambil stok:", err);
        return reply("⚠️ Terjadi kesalahan saat memproses permintaan.");
    }
}
break;
case 'setnamaproduk': {
    if (!isCreator) return reply("Fitur khusus Owner!");

    let data = q.split("|");
    if (data.length < 2) {
        return reply(`❌ Format salah!\nContoh: ${prefix + command} ID_PRODUK|Nama Baru`);
    }

    let productId = data[0].trim();
    let newName = data[1].trim();

    if (!productId || !newName) {
        return reply("❌ ID Produk dan Nama Baru tidak boleh kosong.");
    }
    
    try {

        const updatedProduct = await Produk.findOneAndUpdate(
            { id: productId },
            { name: newName },
            { new: true } 
        );

        if (!updatedProduct) {
            return reply(`⚠️ Produk dengan ID *${productId}* tidak ditemukan.`);
        }


        reply(`✅ Nama produk dengan ID *${productId}* berhasil diubah menjadi *${updatedProduct.name}*`);

    } catch (err) {
        console.error("❌ Gagal mengupdate nama produk di MongoDB:", err);
        return reply("⚠️ Terjadi kesalahan saat menyimpan perubahan nama produk.");
    }
}
break;

case 'setnamavariant': {
    if (!isCreator) return reply("Fitur khusus Owner!");

    let data = q.split("|");
    if (data.length < 2) {
        return reply(`❌ Format salah!\nContoh: ${prefix + command} ID_VARIAN|Nama Baru`);
    }

    let variantId = data[0].trim();
    let newVariantName = data[1].trim();

    if (!variantId || !newVariantName) {
        return reply("❌ ID Varian dan Nama Baru tidak boleh kosong.");
    }
    
    try {

        const product = await Produk.findOne({ [`variants.${variantId}.id`]: variantId });

        if (!product) {
            return reply(`⚠️ Varian dengan ID *${variantId}* tidak ditemukan dalam produk manapun.`);
        }

        const variant = product.variants.get(variantId);
        const oldVariantName = variant.name;


        variant.name = newVariantName;


        product.markModified('variants');
        

        await product.save();
        
        reply(`✅ Nama varian *${oldVariantName}* (ID: ${variantId}) pada produk *${product.name}* berhasil diubah menjadi *${newVariantName}*`);

    } catch (err) {
        console.error("❌ Gagal mengupdate nama varian di MongoDB:", err);
        return reply("⚠️ Terjadi kesalahan saat menyimpan perubahan nama varian.");
    }
}
break;
case 'setcodeqr': {
    if (!isCreator) return reply("Fitur ini khusus untuk Owner Bot!");

    const newCodeQr = q.trim(); 
    if (!newCodeQr) {
        return reply(`❌ Format salah! Masukkan template QRIS statis yang baru.\nContoh: ${prefix + command} TEMPLATE_QRIS_BARU_PANJANG_ANDA`);
    }

    const settingsFilePath = './settings.js';
    const variableName = 'global.codeqr';

    try {
        let settingsContent = fs.readFileSync(settingsFilePath, 'utf8');

        const regex = new RegExp(`(${variableName}\\s*=\\s*)(\`[\\s\\S]*?\`|"[^"]*"|'[^']*');?`, 'is');

        const newAssignment = `${variableName} = \`${newCodeQr.replace(/`/g, '\\`')}\`;`; 

        if (regex.test(settingsContent)) {
            settingsContent = settingsContent.replace(regex, newAssignment);
            
            fs.writeFileSync(settingsFilePath, settingsContent, 'utf8');
            global.codeqr = newCodeQr; // Update di memori
            
            reply(`✅ Template QRIS statis (global.codeqr) berhasil diperbarui.`);
            console.log(`Template QRIS statis diperbarui. File settings.js telah diupdate.`);
        } else {
            console.error(`[SETCODEQR] Baris untuk '${variableName}' tidak ditemukan atau formatnya tidak cocok di settings.js. Pastikan baris seperti '${variableName} = \`isi_awal\`;' sudah ada.`);
            reply(`⚠️ Gagal memperbarui template QRIS. Pastikan variabel ${variableName} sudah ada di settings.js dengan format yang benar (disarankan menggunakan backtick \` \` untuk nilai).`);
        }
    } catch (err) {
        console.error(`[SETCODEQR] Error saat membaca atau menulis ${settingsFilePath}:`, err);
        reply(`⚠️ Terjadi kesalahan saat mencoba memperbarui template QRIS statis di ${settingsFilePath}.`);
    }
}
break
case 'setsnkvariant': {
    if (!isCreator) return reply("Fitur khusus Owner!");

    let data = q.split("|");
    if (data.length < 2) {
        return reply(`❌ Format salah!\nContoh: ${prefix + command} ID_VARIAN|S&K Baru`);
    }

    let variantId = data[0].trim();
    let newSNK = data[1].trim();

    if (!variantId || !newSNK) {
        return reply("❌ ID Varian dan S&K Baru tidak boleh kosong.");
    }
    
    try {

        const product = await Produk.findOne({ [`variants.${variantId}.id`]: variantId });

        if (!product) {
            return reply(`⚠️ Varian dengan ID *${variantId}* tidak ditemukan dalam produk manapun.`);
        }

        const variant = product.variants.get(variantId);
        

        variant.snk = newSNK;


        product.markModified('variants');
        

        await product.save();
        
        reply(`✅ S&K (Syarat & Ketentuan) untuk varian *${variant.name || variant.id}* (ID: *${variantId}*) pada produk *${product.name}* berhasil diperbarui menjadi:\n\n_${newSNK}_`);

    } catch (err) {
        console.error("❌ Gagal mengupdate S&K varian di MongoDB:", err);
        return reply("⚠️ Terjadi kesalahan saat menyimpan perubahan S&K varian.");
    }
}
break;
case 'setdeskproduk': {
    if (!isCreator) return reply("Fitur khusus Owner!");

    let data = q.split("|");
    if (data.length < 2) {
        return reply(`❌ Format salah!\nContoh: ${prefix + command} ID_PRODUK|Deskripsi Baru`);
    }

    let productId = data[0].trim();
    let newDescription = data[1].trim();

    if (!productId || !newDescription) {
        return reply("❌ ID Produk dan Deskripsi Baru tidak boleh kosong.");
    }
    
    try {

        const updatedProduct = await Produk.findOneAndUpdate(
            { id: productId },
            { desc: newDescription },
            { new: true } 
        );

        if (!updatedProduct) {
            return reply(`⚠️ Produk dengan ID *${productId}* tidak ditemukan.`);
        }


        const productName = updatedProduct.name || updatedProduct.id;
        reply(`✅ Deskripsi produk *${productName}* (ID: *${productId}*) berhasil diubah menjadi:\n\n_${updatedProduct.desc}_`);

    } catch (err) {
        console.error("❌ Gagal mengupdate deskripsi produk di MongoDB:", err);
        return reply("⚠️ Terjadi kesalahan saat menyimpan perubahan deskripsi produk.");
    }
}
break;

case 'setdeskvariant': {
    if (!isCreator) return reply("Fitur khusus Owner!");

    let data = q.split("|");
    if (data.length < 2) {
        return reply(`❌ Format salah!\nContoh: ${prefix + command} ID_VARIAN|Deskripsi Baru`);
    }

    let variantId = data[0].trim();
    let newDescription = data[1].trim();

    if (!variantId || !newDescription) {
        return reply("❌ ID Varian dan Deskripsi Baru tidak boleh kosong.");
    }
    
    try {

        const product = await Produk.findOne({ [`variants.${variantId}.id`]: variantId });

        if (!product) {
            return reply(`⚠️ Varian dengan ID *${variantId}* tidak ditemukan dalam produk manapun.`);
        }

        const variant = product.variants.get(variantId);
        const oldDescription = variant.desc;


        variant.desc = newDescription;


        product.markModified('variants');
        

        await product.save();
        
        reply(`✅ Deskripsi varian *${variant.name || variant.id}* (ID: *${variantId}*) pada produk *${product.name}* berhasil diubah menjadi:\n\n_${newDescription}_`);

    } catch (err) {
        console.error("❌ Gagal mengupdate deskripsi varian di MongoDB:", err);
        return reply("⚠️ Terjadi kesalahan saat menyimpan perubahan deskripsi varian.");
    }
}
break;
case 'sethargavariant': {
    if (!isCreator) return reply("Fitur khusus Owner!");

    let data = q.split("|");
    if (data.length < 2) {
        return reply(`❌ Format salah!\nContoh: *${prefix + command} ID_VARIAN|Harga_Baru*`);
    }

    let variantId = data[0].trim();
    let newPriceText = data[1].trim();

    if (!variantId || !newPriceText) {
        return reply("❌ ID Varian dan Harga Baru tidak boleh kosong.");
    }
    let newPrice = parseInt(newPriceText);

    if (isNaN(newPrice) || newPrice < 0) {
        return reply(`⚠️ Harga harus berupa angka positif.`);
    }

    try {

        const product = await Produk.findOne({ [`variants.${variantId}.id`]: variantId });

        if (!product) {
            return reply(`⚠️ Varian dengan ID *${variantId}* tidak ditemukan dalam produk manapun.`);
        }

        const variant = product.variants.get(variantId);
        const oldPrice = variant.price;


        variant.price = newPrice;


        product.markModified('variants');
        

        await product.save();
        
        reply(`✅ Harga varian *${variant.name || variant.id}* (ID: *${variantId}*) pada produk *${product.name}* telah diperbarui dari *Rp ${toRupiah(oldPrice)}* menjadi *Rp ${toRupiah(newPrice)}*.`);

    } catch (err) {
        console.error("❌ Gagal mengupdate harga varian di MongoDB:", err);
        return reply("⚠️ Terjadi kesalahan saat menyimpan perubahan harga varian.");
    }
}
break;

case 'setterjual': {
    if (!isCreator) return reply("Fitur khusus Owner!");

    let data = q.split("|");
    if (data.length < 2) {
        return reply(`❌ Format salah!\nContoh: *${prefix + command} ID_PRODUK/ID_VARIAN|Jumlah_Terjual*`);
    }

    let idToUpdate = data[0].trim();
    let soldAmountText = data[1].trim();

    if (!idToUpdate || !soldAmountText) {
        return reply("❌ ID (Produk/Varian) dan Jumlah Terjual tidak boleh kosong.");
    }

    let soldAmount = parseInt(soldAmountText);
    if (isNaN(soldAmount) || soldAmount < 0) {
        return reply(`⚠️ Jumlah terjual harus berupa angka positif (0 atau lebih).`);
    }

    try {
        let found = false;
        let itemType = "";
        let itemName = "";
        let parentProductName = "";

        const updatedProduct = await Produk.findOneAndUpdate(
            { id: idToUpdate },
            { terjual: soldAmount },
            { new: true }
        );

        if (updatedProduct) {
            return reply("⚠️ Sebaiknya gunakan ID Varian untuk mengatur jumlah terjual, karena total terjual produk dihitung dari jumlah terjual semua variannya.");
        }


        const updateResult = await Produk.findOneAndUpdate(
            { [`variants.${idToUpdate}.id`]: idToUpdate },
            { $set: { [`variants.${idToUpdate}.terjual`]: soldAmount } },
            { new: true }
        );

        if (updateResult) {
            const variant = updateResult.variants.get(idToUpdate);
            itemName = variant.name || variant.id;
            parentProductName = updateResult.name || updateResult.id;
            
            return reply(`✅ Jumlah terjual untuk Varian *${itemName}* (ID: *${idToUpdate}*) pada produk *${parentProductName}* telah diperbarui menjadi *${soldAmount}* unit.`);
        } else {
            return reply(`⚠️ Produk atau Varian dengan ID *${idToUpdate}* tidak ditemukan.`);
        }

    } catch (err) {
        console.error("❌ Gagal menyimpan perubahan jumlah terjual di MongoDB:", err);
        return reply("⚠️ Terjadi kesalahan saat menyimpan perubahan jumlah terjual.");
    }
}
break;
case 'bc':
case 'broadcast':
case 'sendall': {
    if (!isCreator) return reply("Fitur ini khusus untuk Owner Bot!");

    let mediaUrl = null;
    let broadcastText = text;


    if (m.quoted && isMedia) {
        if (!/image|video/.test(mime)) {
            return reply(`❌ Media yang di-reply harus berupa gambar atau video untuk broadcast.`);
        }
        await reply("⏳ Sedang mengunggah media untuk broadcast...");
        try {
            let mediaBuffer = await quoted.download();
            const tempFilePath = `./temp_broadcast_media_${Date.now()}.${mime.split('/')[1]}`;
            fs.writeFileSync(tempFilePath, mediaBuffer);
            mediaUrl = await TelegraPh(tempFilePath);
            fs.unlinkSync(tempFilePath);
            
            if (m.quoted.caption) {
                broadcastText = m.quoted.caption;
            }
        } catch (error) {
            console.error("Gagal mengunggah media broadcast:", error);
            return reply("⚠️ Gagal mengunggah media untuk broadcast. Silakan coba lagi.");
        }
    } else if (!broadcastText) {
        return reply(`❌ Format salah!\n\nUntuk broadcast teks:\n*${prefix + command} Pesan broadcast Anda*\n\nUntuk broadcast dengan gambar (reply gambar):\n*Reply gambar dengan caption ${prefix + command} Pesan Anda*`);
    }

    await reply("🚀 Memulai broadcast ke semua pengguna...");


    let users = await loadUsers_Rap();

    
    if (!users || users.length === 0) {
        return reply("Tidak ada pengguna yang terdaftar di database untuk broadcast.");
    }

    let successCount = 0;
    let failedCount = 0;
    const broadcastPromises = [];

    for (const user of users) {
        const userJid = user.nomor + '@s.whatsapp.net';
        
        if (userJid === botNumber) continue;

        let messageOptions = {};
        if (mediaUrl) {
            messageOptions = { image: { url: mediaUrl }, caption: broadcastText };
        } else {
            messageOptions = { text: broadcastText };
        }
        
        broadcastPromises.push(
            arap.sendMessage(userJid, messageOptions)
                .then(() => {
                    console.log(`[BROADCAST] Berhasil ke: ${userJid}`);
                    successCount++;
                })
                .catch(err => {
                    console.error(`[BROADCAST] Gagal ke: ${userJid}, Error: ${err.message}`);
                    failedCount++;
                })
        );
        await sleep(500);
    }

    await Promise.allSettled(broadcastPromises);

    await reply(`✅ Broadcast Selesai!\n\nBerhasil dikirim ke: *${successCount}* pengguna.\nGagal dikirim ke: *${failedCount}* pengguna.`);
}
break;
case 'orders': {

    const existingOrder = await PendingOrder.findOne({ userId: m.sender });
    if (existingOrder) {
        return reply(`Anda sedang melakukan transaksi lain. Ketik *${prefix}cancelorder* untuk membatalkan, atau tunggu transaksi sebelumnya selesai.`);
    }

 
    let dataArgs = q.split(" ");
    if (dataArgs.length < 2 || !dataArgs[0] || !dataArgs[1]) {
        return reply(`❌ Format salah!\nContoh: ${prefix + command} CODE_VARIAN Jumlah`);
    }
    
    let variantId = dataArgs[0].trim();
    let jumlahBeli = Number(dataArgs[1]);

    if (isNaN(jumlahBeli) || jumlahBeli <= 0) {
        return reply("⚠️ Jumlah beli tidak valid. Harap masukkan angka lebih dari 0.");
    }

    try {

        const [product, user] = await Promise.all([
            Produk.findOne({ [`variants.${variantId}`]: { $exists: true } }),
            User.findOne({ nomor: m.sender.split("@")[0] })
        ]);


        if (!product) {
            return reply(`⚠️ Varian dengan CODE *${variantId}* tidak ditemukan.`);
        }
        const variantDataFound = product.variants.get(variantId);
        const stokTersedia = variantDataFound.stok ? variantDataFound.stok.length : 0;

        if (stokTersedia < jumlahBeli) {
            return reply(`⚠️ Stok hanya tersedia ${stokTersedia}. Harap pesan tidak melebihi stok yang ada.\n\nJika stok habis, Anda bisa ketik *${prefix}restok ${variantId}* untuk mendapat notifikasi saat stok kembali tersedia.`);
        }
        

        if (!user) {
            return reply(`Nomor Anda (${m.sender.split("@")[0]}) tidak terdaftar! Silakan daftar terlebih dahulu.`);
        }
        
        const hargaSatuan = getHargaSetelahDiskon(variantDataFound);
        const totalHarga = hargaSatuan * jumlahBeli;
        
        if (user.balance < totalHarga) {
            return reply(`Saldo tidak cukup!\n\nSaldo Anda: Rp ${toRupiah(user.balance)}\nTotal Pesanan: Rp ${toRupiah(totalHarga)}\n\nSilakan deposit terlebih dahulu dengan perintah *${prefix}deposit jumlah*`);
        }
        

        await reply(`⏳ Saldo Anda cukup (Rp ${toRupiah(user.balance)}).\nMemproses pembelian *${product.name} ${variantDataFound.name}* seharga Rp ${toRupiah(totalHarga)}...`);
        


        const dataStokDiberikan = variantDataFound.stok.splice(0, jumlahBeli);
        variantDataFound.terjual = (variantDataFound.terjual || 0) + jumlahBeli;
        product.markModified('variants');


        user.balance -= totalHarga;
        

        await Promise.all([
            product.save(),
            user.save()
        ]);


        const waktuTransaksi = moment().tz('Asia/Jakarta');
        const tanggalTransaksiFormatted = waktuTransaksi.format('DD-MM-YYYY');
        const jamTransaksiFormatted = waktuTransaksi.format('HH:mm:ss');


        const ownerToNotify = global.owner[0];
        if (ownerToNotify) {
            let ownerMsg = `🔔 *ORDER VIA SALDO BERHASIL* 🔔\n\n` +
                           `👤 Pembeli: ${pushname} @${m.sender.split("@")[0]}\n` +
                           `📦 Produk: ${product.name} - ${variantDataFound.name}\n` +
                           `🔢 Jumlah: ${jumlahBeli}\n` +
                           `💰 Total Harga: Rp ${toRupiah(totalHarga)}\n` +
                           `💳 Jenis Bayar: Saldo Akun\n` +
                           `🗓️ Tanggal: ${tanggalTransaksiFormatted} ${jamTransaksiFormatted} WIB`;
            try {
                await arap.sendMessage(ownerToNotify.replace(/[^0-9]/g, '') + '@s.whatsapp.net', { text: ownerMsg, mentions: [m.sender] });
            } catch (ownerErr) { console.error("[ORDERS] Gagal kirim notif ke owner:", ownerErr); }
        }


        let accountsTextForReceipt = "";
        dataStokDiberikan.forEach((item, index) => {
            const [email, pass, twofa='-', profil='-', pin='-'] = item.split('|');
            accountsTextForReceipt += `│•${email}\n`;
            accountsTextForReceipt += `│•${pass}\n`;
            accountsTextForReceipt += `│•${twofa}\n`;
            accountsTextForReceipt += `│•${profil}\n`;
            accountsTextForReceipt += `│•${pin}\n`;
        });

        let successMsgUser = `╭───〔 *TRANSAKSI SUKSES* 🎉 〕\n` +
                             `\n` +
                             `╭──〔 DETAIL PRODUK 📦〕\n` +
                             `│  • Produk: ${product.name}\n` +
                             `│  • Varian: ${variantDataFound.name}\n` +
                             `│  • Total Bayar: Rp ${toRupiah(totalHarga)}\n` +
                             `╰──\n\n` +
                             `╭──〔 *INFORMASI SALDO* 〕\n` +
                             `│  • Saldo Sekarang: Rp ${toRupiah(user.balance)}\n` +
                             `│\n` +
                             `│─ *WAKTU TRANSAKSI* ⏰\n` +
                             `│  • ${tanggalTransaksiFormatted} ${jamTransaksiFormatted} WIB\n` +
                             `╰──\n\n` +
                             `╭──〔 *DETAIL ACCOUNT* 〕\n` +
                             `${accountsTextForReceipt}` +
                             `│\n` +
                             `│ ─ *S & K PRODUCT*\n│\n` +
                             `│  • ${variantDataFound.snk || "Tidak ada S&K khusus."}\n` +
                             `│\n` +
                             `╰─────────────────`;

        await arap.sendMessage(m.sender, { text: successMsgUser });
        // Kirim detail akun (auto VCC/default)
        const det = buildDetailBlock(dataStokDiberikan);
        await arap.sendMessage(m.sender, { text: det.text });   } catch (err) {
        console.error("❌ Gagal memuat topsaldo dari MongoDB:", err);
        return reply("⚠️ Terjadi kesalahan saat mencoba memuat daftar topsaldo.");
    }
}
break;
case 'listsaldo':
case 'semuasaldo': {
    if (!isCreator) return reply("Fitur ini khusus untuk Owner Bot!");

    try {

        const users = await loadUsers_Rap();

        if (!users || users.length === 0) {
            return reply("🏆 Belum ada pengguna yang terdaftar di database.");
        }

        let teks = `📊 *DAFTAR SALDO PENGGUNA* 📊\n\n`;
        teks += `Total Pengguna: ${users.length}\n`;
        teks += `-----------------------------------\n\n`;

        users.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));

        users.forEach((user, index) => {
            teks += `${index + 1}. *${user.nama || user.nomor}*\n`;
            teks += `   - Nomor: @${user.nomor}\n`;
            teks += `   - Saldo: *Rp ${toRupiah(user.balance || 0)}*\n\n`;
        });
        teks += `-----------------------------------\n\n`;
        teks += `Data diambil dari database MongoDB.`;

        const mentions = users.map(user => user.nomor + '@s.whatsapp.net');
        arap.sendMessage(m.chat, {
            text: teks,
            mentions: mentions
        }, { quoted: m });
    } catch (err) {
        console.error("❌ Gagal memuat daftar saldo dari MongoDB:", err);
        return reply("⚠️ Terjadi kesalahan saat mencoba memuat daftar saldo.");
    }
}
break;
case 'cekstok':
case 'stock': { 
    try {

        let produkData = await loadProdukData_Rap();
        
        if (Object.keys(produkData).length === 0) {
            return reply("📦 Belum ada produk yang tersedia di database.");
        }
        
        let teks = "📊 *DAFTAR STOK PRODUK SAAT INI* 📊\n\n";
        let adaStokYangDitampilkan = false;
        
        const sortedProdukArray = Object.values(produkData).sort((a, b) => {
            return (a.name || '').localeCompare(b.name || '');
        });

        for (let produk of sortedProdukArray) {

            if (produk.variants && produk.variants.size > 0) {
                const sortedVariants = Array.from(produk.variants.values()).sort((a, b) => {
                    return (a.name || '').localeCompare(b.name || '');
                });

                for (let variant of sortedVariants) {
                    const stokCount = variant.stok ? variant.stok.length : 0;
                    const stockStatus = stokCount > 0 ? "✅" : "❌";
                    
                    teks += `${stockStatus} *${produk.name}* *${variant.name}*: *${stokCount}X*\n`;
                    adaStokYangDitampilkan = true;
                }
            }
        }
        
        if (!adaStokYangDitampilkan) {
             return reply("📦 Tidak ada varian produk dengan stok yang dapat ditampilkan saat ini.");
        }
        
        return reply(teks);
        
    } catch (err) {
        console.error("Error di case 'cekstok':", err);
        return reply("❌ Terjadi kesalahan saat memeriksa stok!");
    }
}
break;


case 'liststok': { 
    try {
        let produkData = await loadProdukData_Rap();
        if (!produkData || Object.keys(produkData).length === 0) {
            return reply("📦 Belum ada produk di database.");
        }

        const ownerDisplayNumber = global.owner[0] ? global.owner[0].split('@')[0] : 'OWNER_TIDAK_DISET';
        const linkGcDisplay = global.linkgc || 'LINK_GRUP_TIDAK_DISET';

        let teks = `*╭────〔 PRODUCT LIST📦 〕*\n`;
        teks += `*┊ ・* Ketik *${prefix}caraorder* untuk mengetahui cara order\n`;
        teks += `*┊ ・* Beli tanpa deposit: *${prefix}beli (kode) (jumlah)*\n`;
        teks += `*┊ ・* Contoh: *${prefix}beli 10droppp*\n`;
        teks += `*┊ ・* Pastikan Kode & Jumlah Akun diketik dengan *benar*\n`;
        teks += `*╰┈┈┈┈┈┈┈┈*\n\n`;

        const allProductsArray = [];
        const allFlattenedItems = [];

        for (const productId in produkData) {
            const produk = produkData[productId];
            if (!produk || !produk.name) {
                 continue;
            }

            allProductsArray.push({
                id: productId,
                name: produk.name,
                desc: produk.desc,
                variants: produk.variants,
                price: produk.price,
                stok: produk.stok,
                terjual: produk.terjual
            });

            if (produk.variants && produk.variants.size > 0) {
                for (const variant of Array.from(produk.variants.values())) {
                    if (!variant || !variant.name) {
                        continue;
                    }
                    allFlattenedItems.push({
                        productId: productId,
                        productName: produk.name,
                        variantId: variant.id,
                        variantName: variant.name,
                        price: variant.price,
                        stok: variant.stok ? variant.stok.length : 0,
                        terjual: variant.terjual || 0,
                        desc: variant.desc || produk.desc,
                        rawVariant: variant,
                        isVariant: true
                    });
                }
            } else {
                allFlattenedItems.push({
                    productId: productId,
                    productName: produk.name,
                    variantId: "",
                    variantName: "",
                    price: produk.price || 0,
                    stok: produk.stok ? produk.stok.length : 0,
                    terjual: produk.terjual || 0,
                    desc: produk.desc,
                    rawVariant: produk,
                    isVariant: false
                });
            }
        }

        if (allFlattenedItems.length === 0) {
            return reply("📦 Tidak ada produk atau varian yang dapat ditampilkan.");
        }

        allFlattenedItems.sort((a, b) => (b.terjual || 0) - (a.terjual || 0));

        const topSellersItems = allFlattenedItems.slice(0, Math.min(3, allFlattenedItems.length));
        
        const topSellerProcessedProductIds = new Set();

        teks += `*╭──〔 PRODUK \`TERLARIS\`🔥 〕*\n`;
        let topSellerCounter = 1;

        for (const item of topSellersItems) {
            if (!topSellerProcessedProductIds.has(item.productId)) {
                teks += `\n*〔 ${topSellerCounter} 〕${item.productName}*\n`;
                teks += `╭┈┈┈┈┈┈┈┈\n`;
                topSellerCounter++;
                topSellerProcessedProductIds.add(item.productId);

                if (item.isVariant) {
                     const relatedTopVariants = topSellersItems.filter(v => v.productId === item.productId).sort((a, b) => b.terjual - a.terjual);
                     relatedTopVariants.forEach((variantItem, index) => {
                         const hargaAsli = variantItem.price;
                         const hargaDiskon = getHargaSetelahDiskon(variantItem.rawVariant);
                         let teksHarga = `Rp ${toRupiah(hargaDiskon)}`;
                         if (hargaDiskon < hargaAsli) {
                             teksHarga += ` ~~Rp ${toRupiah(hargaAsli)}~~`;
                         }
                         teks += `┊ *• ${variantItem.variantName}*\n`;
                         teks += `┊   🏷️| Harga: ${teksHarga}\n`;
                         teks += `┊   📦| Stok: ${variantItem.stok}\n`;
                         teks += `┊   🧾| Terjual: ${variantItem.terjual}\n`;
                         teks += `┊   🔐| Code: *${variantItem.variantId}*\n`;
                         if (index < relatedTopVariants.length - 1) {
                             teks += `┊ ┈┈┈┈┈┈┈┈\n`;
                         }
                     });
                } else {
                    const hargaAsli = item.price;
                    const hargaDiskon = getHargaSetelahDiskon(item.rawVariant);
                    let teksHarga = `Rp ${toRupiah(hargaDiskon)}`;
                    if (hargaDiskon < hargaAsli) {
                        teksHarga += ` ~~Rp ${toRupiah(hargaAsli)}~~`;
                    }
                    teks += `┊ • 🏷️| Harga: ${teksHarga}\n`;
                    teks += `┊ • 📦| Stok: ${item.stok}\n`;
                    teks += `┊ • 🧾| Terjual: ${item.terjual}\n`;
                    teks += `┊ • 🔐| Code: *${item.productId}*\n`;
                    teks += `┊ • 📑| Deskripsi: ${item.desc || '-'}\n`;
                }
                 teks += `╰┈┈┈┈┈┈┈┈\n\n`;
            }
        }
        if (topSellerCounter === 1) {
            teks += `  Belum ada produk terlaris saat ini.\n\n`;
        }

        const otherProducts = allProductsArray
            .filter(p => !topSellerProcessedProductIds.has(p.id))
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        if (otherProducts.length > 0) {
            teks += `*╭──〔 PRODUK LAINNYA 〕*\n`;
            let otherCounter = 1;
            for (const produk of otherProducts) {
                teks += `\n*〔 ${otherCounter} 〕${produk.name || 'Tanpa Nama'}*\n`;
                teks += `╭┈┈┈┈┈┈┈┈\n`;
                otherCounter++;

                if (produk.variants && produk.variants.size > 0) {
                    let sortedVariants = Array.from(produk.variants.values()).sort((a, b) => (a.price || 0) - (b.price || 0));
                    
                    sortedVariants.forEach((variant, index) => {
                        const hargaAsli = variant.price;
                        const hargaDiskon = getHargaSetelahDiskon(variant);
                        let teksHarga = `Rp ${toRupiah(hargaDiskon)}`;
                        if (hargaDiskon < hargaAsli) {
                            teksHarga += ` ~~Rp ${toRupiah(hargaAsli)}~~`;
                        }
                        teks += `┊ *• ${variant.name || 'Tanpa Nama'}*\n`;
                        teks += `┊   🏷️| Harga: ${teksHarga}\n`;
                        teks += `┊   📦| Stok: ${variant.stok ? variant.stok.length : 0}\n`;
                        teks += `┊   🧾| Terjual: ${variant.terjual || 0}\n`;
                        teks += `┊   🔐| Code: *${variant.id}*\n`;
                        if (index < sortedVariants.length - 1) {
                            teks += `┊ ┈┈┈┈┈┈┈┈\n`;
                        }
                    });
                } else {
                    const hargaAsli = produk.price;
                    const hargaDiskon = getHargaSetelahDiskon(produk);
                    let teksHarga = `Rp ${toRupiah(hargaDiskon)}`;
                    if (hargaDiskon < hargaAsli) {
                        teksHarga += ` ~~Rp ${toRupiah(hargaAsli)}~~`;
                    }
                    teks += `┊ • 🏷️| Harga: ${teksHarga}\n`;
                    teks += `┊ • 📦| Stok: ${produk.stok ? produk.stok.length : 0}\n`;
                    teks += `┊ • 🧾| Terjual: ${produk.terjual || 0}\n`;
                    teks += `┊ • 🔐| Code: *${produk.id}*\n`;
                    teks += `┊ • 📑| Deskripsi: ${produk.desc || '-'}\n`;
                }
                teks += `╰┈┈┈┈┈┈┈┈\n\n`;
            }
        }
        
        arap.sendMessage(m.chat, { text: teks, mentions: [ownerDisplayNumber + '@s.whatsapp.net'] }, { quoted: m });

    } catch (err) {
        console.error("❌ Gagal memuat daftar produk dari MongoDB:", err);
        return reply("⚠️ Terjadi kesalahan saat memuat data produk.");
    }
}
break;

case 'delvariant': {
    if (!isCreator) return reply("Fitur khusus Owner!");

    const argsSplit = q.split("|");
    if (argsSplit.length < 2) {
        return reply(`❌ Format salah!\nContoh: ${prefix + command} ID_PRODUK|ID_VARIAN`);
    }

    const productId = argsSplit[0].trim();
    const variantId = argsSplit[1].trim();

    if (!productId || !variantId) {
        return reply("❌ ID Produk dan ID Varian tidak boleh kosong.");
    }

    try {

        const product = await Produk.findOne({ id: productId });
        if (!product) {
            return reply(`⚠️ Produk dengan ID *${productId}* tidak ditemukan.`);
        }


        if (!product.variants.get(variantId)) {
            return reply(`⚠️ Varian dengan ID *${variantId}* tidak ditemukan dalam produk *${product.name}*.`);
        }
        

        const variantName = product.variants.get(variantId).name || variantId;


        product.variants.delete(variantId);


        await product.save();
        
        reply(`✅ Varian *${variantName}* (ID: ${variantId}) berhasil dihapus dari produk *${product.name}*.`);

    } catch (err) {
        console.error("❌ Gagal menghapus varian dari MongoDB:", err);
        return reply("⚠️ Terjadi kesalahan saat menyimpan perubahan data produk.");
    }
}
break;
case 'deposit':
case 'depo':
case 'topup': {
    const existingOrder = await PendingOrder.findOne({ userId: m.sender });
    if (existingOrder) {
        return reply(`Anda sedang memiliki transaksi lain. Ketik *${prefix}cancelorder* untuk membatalkan.`);
    }

    if (args.length < 1) return reply(`❌ Format salah!\nContoh: ${prefix + command} 10000`);
    const jumlahDeposit = parseInt(args[0]);
    if (isNaN(jumlahDeposit) || jumlahDeposit < 100) {
        return reply(`⚠️ Jumlah deposit minimal adalah Rp 100.`);
    }

    await reply("⏳ Membuat QR Pembayaran...");

    const orderId = crypto.randomBytes(8).toString('hex');

    const feePersen = Math.floor(jumlahDeposit * (Math.random() * (0.01 - 0.001) + 0.001));
    const feeAcak = Math.floor(Math.random() * (100 - 15 + 1)) + 15;
    const adminFee = feePersen + feeAcak;
    const initialTotalBayar = jumlahDeposit + adminFee;

const totalBayar = await getUniqueTotalBayar(initialTotalBayar);

    const qrisDataPath = './GATEWAY/qris.json';
    if (!fs.existsSync(qrisDataPath)) {
        return reply("⚠️ Konfigurasi QRIS (qris.json) tidak ditemukan. Hubungi admin.");
    }
    const qrisData = JSON.parse(fs.readFileSync(qrisDataPath, 'utf8'));
    let qrisString = qrisData.qris_string;
    let qrisDihapusCRC = qrisString.slice(0, -4).replace('010211', '010212');
    const parts = qrisDihapusCRC.split('5802ID');
    const tagNominal = `54${String(totalBayar.toString().length).padStart(2, '0')}${totalBayar}5802ID`;
    const rawQris = parts[0] + tagNominal + parts[1];
    const finalQrisString = rawQris + toCRC16(rawQris); // toCRC16 sudah ada di arap.js

    const expirationTime = new Date(Date.now() + (5 * 60 * 1000));
    const formatted = moment(expirationTime).tz('Asia/Jakarta').format('HH:mm:ss');
    
    const captionQR = 
`╭───「 *DEPOSIT SALDO* 」───
│
│  Scan QRIS untuk menyelesaikan pembayaran.
│ 
│ • ID TRANSAKSI: ${orderId}
│
├─ *DETAIL PEMBAYARAN:*
│ • Jumlah Deposit: Rp ${toRupiah(jumlahDeposit)}
│ • Biaya Admin: Rp ${toRupiah(adminFee)}
│ • *Total Bayar: Rp ${toRupiah(totalBayar)}*
│
├─ *PENTING:*
│ • Harap transfer sesuai nominal *Total Bayar*.
│
├─ *WAKTU PEMBAYARAN:*
│ • Batas Waktu: 5 Menit
│ • Expired: ${formatted} WIB)
│
╰───────────────────\n\nKetik *cancelorder* untuk membatalkan.`;

    let qrMessage;
    try {
        const qrImageBuffer = await QRCode.toBuffer(finalQrisString);
        qrMessage = await arap.sendMessage(m.sender, { image: qrImageBuffer, caption: captionQR });
    } catch (error) {
        return reply("Gagal mengirimkan QR pembayaran. Silakan coba lagi.");
    }
    
   // const orderId = crypto.randomBytes(8).toString('hex');
    const newPendingOrder = {
        userId: m.sender,
        orderId: orderId,
        transactionId: orderId, // Untuk sistem ini, kita bisa samakan
        productId: 'DEPOSIT',
        variantId: 'DEPOSIT',
        type: "deposit",
        jumlahDeposit: jumlahDeposit,
        totalBayar: totalBayar,
        feeAdmin: adminFee,
        expireAt: expirationTime,
        pushname: pushname,
        timestamp: Date.now(),
        qrMessageKey: qrMessage ? qrMessage.key : null,
        qrMessageChatId: m.sender,
        userNomor: m.sender.split('@')[0],
        status: "pending"
    };
    await saveSinglePendingOrder_Rap(newPendingOrder);

    await reply("✅ QRIS dikirim. Silakan selesaikan pembayaran dalam waktu 5 menit!");
    
    setTimeout(() => checkDepo_Rap(arap, m.sender), 15000);
}
break;
case 'batalqris': {
    const fs = require('fs');
    const idUser = m.sender.split("@")[0]; // Ganti sender dengan m.sender atau sesuaikan dengan lingkungan Anda
    const fileJson = `${topupPath}${idUser}.json`;

    if (!fs.existsSync(fileJson)) return reply("⚠️ Tidak ada transaksi QRIS yang aktif.");

    const data = JSON.parse(fs.readFileSync(fileJson));
    if (data.session !== "menunggu_pembayaran") return reply("⚠️ Tidak ada transaksi QRIS API yang sedang menunggu pembayaran.");

    // Hapus pesan QRIS
    if (data.qrmsgid) {
        await arap.sendMessage(m.sender, { delete: data.qrmsgid }).catch(() => {});
    }
    
    // Batalkan pesanan di database (jika orderId ada)
    if (data.orderId) {
        // Asumsi: orderId dari sesi file sesuai dengan orderId di PendingOrder
        const canceledOrder = await PendingOrder.findOneAndUpdate(
            { orderId: data.orderId, status: "pending" }, 
            { status: "canceled_user" }
        );
        
        // TODO: Tambahkan LOGIKA PENGEMBALIAN STOK di sini jika order ditemukan dan dibatalkan.
        if (canceledOrder) {
             console.log(`[DEBUG] Order ${data.orderId} dibatalkan oleh pengguna. Stok perlu dikembalikan.`);
             // Logika pengembalian stok harus diimplementasikan di sini
        }
    }

    // Hapus file sesi
    fs.unlinkSync(fileJson);
    return reply("✅ Transaksi QRIS berhasil dibatalkan. Pesanan yang terkait juga telah dibatalkan (jika ada).");
}
break;
 case 'buy':
case 'beli':
case 'order': { 
    // Pastikan modul yang dibutuhkan tersedia
    const axios = require('axios');
    const fs = require('fs');
    const moment = require('moment-timezone');
    const crypto = require('crypto');
    
    // Asumsi: idUser, topupPath, dan fileJson terkait dengan sesi pembayaran per pengguna
    const idUser = m.sender.split("@")[0];
    const fileJson = `${topupPath}${idUser}.json`; 
    
    // Pengecekan order yang sedang berlangsung (dari PendingOrder)
    const existingOrder = await PendingOrder.findOne({ userId: m.sender });

    // --- Cek Order & Sesi QRIS API ---
    let isApiSessionPending = false;
    let sesiAPI = null;
    if (fs.existsSync(fileJson)) {
        try {
            sesiAPI = JSON.parse(fs.readFileSync(fileJson));
            
            // Periksa apakah order yang terkait di DB sudah sukses (PEMBERSIHAN TOTAL DI AWAL)
            if (existingOrder && (existingOrder.status === 'paid' || existingOrder.status === 'delivered')) {
                 fs.unlinkSync(fileJson); 
                 await PendingOrder.deleteOne({ _id: existingOrder._id });
                 return reply(`✅ Transaksi ${existingOrder.orderId} sebelumnya SUKSES. Sesi telah dibersihkan. Silakan lanjutkan transaksi baru.`);
            }
            
            if (sesiAPI.session === "menunggu_pembayaran" && Date.now() < sesiAPI.waktu) {
                 isApiSessionPending = true;
                 const formatted = moment(sesiAPI.waktu).tz('Asia/Jakarta').format('HH:mm:ss');
                 
                 // Pesan PENDING/MENUNGGU
                 const pesan = existingOrder 
                    ? `⚠️ Anda sedang memiliki pesanan di database (*${existingOrder.orderId}*) DAN transaksi QRIS yang belum selesai.\nSisa waktu: hingga ${formatted} WIB.\nKetik *${prefix}cancelorder* untuk membatalkan pesanan ini, atau *${prefix}batalqris* untuk membatalkan QRIS API.`
                    : `⚠️ Anda sedang memiliki transaksi QRIS yang belum selesai.\nSisa waktu: hingga ${formatted} WIB.\nKetik *${prefix}batalqris* untuk membatalkan QRIS API.`;
                 
                 return reply(pesan);
            } else if (Date.now() >= sesiAPI.waktu) {
                // Sesi di file JSON sudah expired, hapus file JSON-nya
                fs.unlinkSync(fileJson);
                console.log(`[DEBUG] Sesi API ${sesiAPI.orderId} sudah expired dan file dihapus.`);
            }
        } catch (e) {
            console.error("[BUY-ERROR] Gagal parse fileJson:", e);
            fs.unlinkSync(fileJson); // Hapus file corrupted
        }
    }

    if (existingOrder) {
        if (existingOrder.status === 'pending') {
             return reply(`Anda sudah memiliki pesanan yang sedang berlangsung (*${existingOrder.orderId}*). Harap selesaikan atau batalkan pesanan tersebut dengan mengetik *${prefix}cancelorder*`);
        } else if (existingOrder.status === 'paid' || existingOrder.status === 'delivered') {
             // PEMBERSIHAN TOTAL SETELAH SUKSES 
             await PendingOrder.deleteOne({ _id: existingOrder._id });
             return reply(`✅ Anda memiliki riwayat pesanan *${existingOrder.orderId}* dengan status *${existingOrder.status.toUpperCase()}*. Sesi telah dibersihkan. Silakan lanjutkan transaksi baru.`);
        }
    }
    // --- Akhir Cek Order & Sesi QRIS API ---

    // ... (Logika Order Baru) ...
    if (args.length < 2) return reply(`❌ Format salah!\nContoh: ${prefix + command} ID_Varian Jumlah`);
    
    const variantId = args[0].trim();
    const jumlahBeli = parseInt(args[1]);

    if (isNaN(jumlahBeli) || jumlahBeli <= 0) return reply("⚠️ Jumlah beli tidak valid.");

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const product = await Produk.findOne({ [`variants.${variantId}`]: { $exists: true } }).session(session);
        
        if (!product) {
            await session.abortTransaction(); session.endSession();
            return reply(`⚠️ Varian dengan ID *${variantId}* tidak ditemukan.`);
        }
        
        const variantDataFound = product.variants.get(variantId);
        if (!variantDataFound.stok || variantDataFound.stok.length < jumlahBeli) {
            await session.abortTransaction(); session.endSession();
            return reply(`⚠️ Stok hanya tersedia ${variantDataFound.stok ? variantDataFound.stok.length : 0}.`);
        }
        
        // --- Perhitungan Harga & Panggilan API QRIS ---
        const hargaSetelahDiskon = getHargaSetelahDiskon(variantDataFound); 
        const totalHargaBarang = hargaSetelahDiskon * jumlahBeli;
        const randomPercent = Math.random() * (0.01 - 0.001) + 0.001; 
        const feePersen = Math.floor(totalHargaBarang * randomPercent);
        const feeAcak = Math.floor(Math.random() * (100 - 15 + 1)) + 15;
        const adminFee = feePersen + feeAcak;
        const initialTotalBayar = totalHargaBarang + adminFee;
        const totalBayar = await getUniqueTotalBayar(initialTotalBayar);
        
        await reply("⏳ Memproses pesanan...\nQR pembayaran akan dikirimkan ke chat pribadi Anda!");
        
        const orderId = crypto.randomBytes(8).toString('hex');

        function toCRC16(str) {
            function charCodeAt(str, i) {
                let get = str.substr(i, 1)
                return get.charCodeAt()
            }
            let crc = 0xFFFF;
            let strlen = str.length;
            for (let c = 0; c < strlen; c++) {
                crc ^= charCodeAt(str, c) << 8;
                for (let i = 0; i < 8; i++) {
                    if (crc & 0x8000) {
                        crc = (crc << 1) ^ 0x1021;
                    } else {
                        crc = crc << 1;
                    }
                }
            }
            hex = crc & 0xFFFF;
            hex = hex.toString(16);
            hex = hex.toUpperCase();
            if (hex.length == 3) {
                hex = "0" + hex;
            }
            return hex;
        }
        function generateDynamicQrisFromStatic(baseQris, amount) {
            if (!baseQris || !amount || amount <= 0) throw new Error("QRIS/amount invalid");
            let qris2 = baseQris.slice(0, -4);
            let replaceQris = qris2.replace("010211", "010212");
            let pecahQris = replaceQris.split("5802ID");
            const nominal = String(Math.floor(amount));
            let uang = "54" + ("0" + nominal.length).slice(-2) + nominal + "5802ID";
            let output = pecahQris[0] + uang + pecahQris[1] + toCRC16(pecahQris[0] + uang + pecahQris[1]);
            return output;
        }

        const PG_ENDPOINT = process.env.PG_ENDPOINT || "https://pg.inyx.site";
        const PG_API_KEY  = process.env.PG_API_KEY  || "kodeku";
        async function checkPaymentViaPG({ totalAmount, createdAtISO, deviceId = null }) {
            const url = `${PG_ENDPOINT}/notifications?limit=50` + (deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : "");
            const headers = { "X-API-Key": PG_API_KEY };
            const res = await axios.get(url, { headers, timeout: 10000 });

            console.log(`\n[PG-CHECK] ==========================================`);
            console.log(`[PG-CHECK] Looking for: amount=${totalAmount}, since=${createdAtISO}`);
            console.log(`[PG-CHECK] Response status:`, res.status);
            console.log(`[PG-CHECK] Response data keys:`, res.data ? Object.keys(res.data) : 'null');

            // Normalisasi struktur respons menjadi array notifikasi
            let items = [];
            if (Array.isArray(res.data?.data)) items = res.data.data;
            else if (Array.isArray(res.data)) items = res.data;
            else if (Array.isArray(res.data?.notifications)) items = res.data.notifications;

            console.log(`[PG-CHECK] Found ${items.length} notifications`);
            console.log(`[PG-CHECK] First 2 items:`, JSON.stringify(items.slice(0, 2), null, 2));

            const createdAtTs = new Date(createdAtISO).getTime();
            console.log(`[PG-CHECK] Created timestamp:`, createdAtTs, new Date(createdAtTs).toISOString());

            const match = items.find(n => {
                try {
                    const postedAt = n.posted_at ? new Date(n.posted_at).getTime() : (n.postedAt ? new Date(n.postedAt).getTime() : 0);
                    const amt = Number(String(n.amount_detected ?? n.amountDetected ?? '').replace(/[^0-9]/g, ''));
                    const pkgOk = (n.package_name === 'com.gojek.gopaymerchant') || String(n.app_name ?? n.appName ?? '').toUpperCase().includes('DANA');
                    
                    console.log(`[PG-CHECK] Checking item: package=${n.package_name ?? n.packageName}, amount=${amt}, pkgOk=${pkgOk}, posted=${postedAt}, created=${createdAtTs}, timeOk=${postedAt >= createdAtTs}`);
                    
                    const isMatch = pkgOk && amt === Number(totalAmount) && postedAt >= createdAtTs;
                    if (isMatch) console.log(`[PG-CHECK] ✅ MATCH FOUND!`);
                    
                    return isMatch;
                } catch (e) {
                    console.log(`[PG-CHECK-ERROR]:`, e.message);
                    return false;
                }
            });

            console.log(`[PG-CHECK] Result:`, !!match);
            console.log(`[PG-CHECK] ==========================================\n`);

            return Boolean(match);
        }

        const QRCode = require('qrcode');
        const path = require('path');
        const Jimp = require('jimp');
        const qrisCfgRaw = fs.readFileSync(require('path').join(__dirname, 'GATEWAY', 'qris.json'));
        const qrisCfg = JSON.parse(qrisCfgRaw.toString());
        const baseQris = qrisCfg.qris_string;
        const dynamicQris = generateDynamicQrisFromStatic(baseQris, totalBayar);

        // Generate QR image buffer
        const qrPngBuffer = await QRCode.toBuffer(dynamicQris, { type: 'png', margin: 1, scale: 8 });
        
        // Try to overlay QR onto background image at image/qris.jpg
        let finalQrBuffer = qrPngBuffer;
        try {
            const bgPath = require('path').join(__dirname, 'image', 'qris.jpg');
            if (fs.existsSync(bgPath)) {
                const bg = await Jimp.read(bgPath);
                const qrImg = await Jimp.read(qrPngBuffer);
                const targetWidth = Math.floor(bg.bitmap.width * 0.6);
                qrImg.resize(targetWidth, Jimp.AUTO);
                const x = Math.floor((bg.bitmap.width - qrImg.bitmap.width) / 2);
                const y = Math.floor((bg.bitmap.height - qrImg.bitmap.height) / 2);
                bg.composite(qrImg, x, y);
                finalQrBuffer = await bg.getBufferAsync(Jimp.MIME_JPEG);
            }
        } catch (e) {
            console.warn('[QR-BG] Failed to compose background, using plain QR:', e.message);
        }
        const expirationTime = Date.now() + 30 * 60 * 1000; // 30 menit

        // Ambil stok yang akan di-reserve (Item pertama di array stok)
        const reservedStockItems = variantDataFound.stok.slice(0, jumlahBeli); 
        
        // ... (Kirim Pesan QRIS SAMA) ...
        const batasWaktu = moment(expirationTime).tz("Asia/Jakarta").format("HH:mm:ss");
        let captionQR = `╭───「 *PEMBAYARAN* 」───\n` +
                        `│\n` +
                        `│ • ID TRX: ${orderId}\n` +
                        `│\n`+
                        `├── *DETAIL PEMBELIAN*\n` +
                        `│  • Produk: ${product.name}\n` +
                        `│  • Varian: ${variantDataFound.name}\n` +
                        `│  • Jumlah: ${jumlahBeli}\n` +
                        `│  • Total Harga: Rp ${toRupiah(totalHargaBarang)}\n` +
                        `│  • Biaya Admin: Rp ${toRupiah(adminFee)}\n` +
                        `│  • *Total Bayar: Rp ${toRupiah(totalBayar)}*\n` +
                        `│\n` +
                        `├── *WAKTU PEMBAYARAN*\n` +
                        `│  • Expired: ${batasWaktu} WIB\n` +
                        `│\n` +
                        `╰───────────────────\n\nKetik *${prefix}cancelorder* untuk membatalkan pesanan ini.`;
        
        const qrMessage = await arap.sendMessage(m.sender, { 
            image: finalQrBuffer, 
            caption: Styles(captionQR), 
            footer: "Pindai QRIS di atas untuk menyelesaikan pembayaran.",
            buttons: [
                { buttonId: `${prefix}cancelorder`, buttonText: { displayText: '❌ BATALKAN PESANAN' }, type: 1 }
            ],
            headerType: 4
        });

        // --- Simpan PendingOrder (Database) ---
        const newPendingOrder = new PendingOrder({
            orderId: orderId, 
            userId: m.sender,
            transactionId: orderId, 
            productId: product._id.toString(),
            variantId: variantId,
            productName: product.name,
            variantName: variantDataFound.name,
            jumlah: jumlahBeli,
            totalBayar: totalBayar,
            variantSnk: variantDataFound.snk,
            qrMessageKey: qrMessage ? qrMessage.key : null,
            qrMessageChatId: m.sender,
            status: "pending",
            expireAt: new Date(expirationTime),
            pushname: pushname, 
            type: "buy", 
            reservedStock: reservedStockItems, // STOK DICOPI DI SINI
            hargaSatuanOriginal: variantDataFound.price,
            hargaSetelahDiskon: hargaSetelahDiskon,
            feeAdmin: adminFee
        });
        
        await newPendingOrder.save({ session });
        await session.commitTransaction();
        session.endSession();
        
        // --- Simpan Sesi Pembayaran (File JSON) ---
        const sessionAPI = {
            session: "menunggu_pembayaran", 
            qrmsgid: qrMessage.key.id,
            totalBayar, 
            orderId: orderId, 
            layanan: `${product.name} - ${variantDataFound.name}`, 
            waktu: expirationTime,
            createdAtISO: new Date().toISOString()
        };
        fs.writeFileSync(fileJson, JSON.stringify(sessionAPI, null, 2));

        // --- Loop Cek Mutasi QRIS (Non-Blocking) ---
        (async () => {
            // Helper: hapus pesan QR menggunakan full key jika tersedia
            async function deleteQrMessageSafe(orderId, chatJid) {
                try {
                    const po = await PendingOrder.findOne({ orderId });
                    if (po && po.qrMessageKey) {
                        await arap.sendMessage(chatJid, { delete: po.qrMessageKey }).catch(() => {});
                        return;
                    }
                    // Fallback: gunakan id dari sesi
                    if (fs.existsSync(fileJson)) {
                        try {
                            const sesiLocal = JSON.parse(fs.readFileSync(fileJson));
                            if (sesiLocal.qrmsgid) {
                                await arap.sendMessage(chatJid, { delete: { remoteJid: chatJid, id: sesiLocal.qrmsgid } }).catch(() => {});
                            }
                        } catch {}
                    }
                } catch {}
            }
            // Improvement #1: Exponential backoff polling
            let pollInterval = 3000;  // mulai dari 3 detik
            const maxInterval = 15000; // maksimal 15 detik
            let pollCount = 0;

            while (fs.existsSync(fileJson)) {
                try {
                    await sleep(pollInterval);

                    if (pollCount < 10) {
                        pollInterval = Math.min(Math.floor(pollInterval * 1.2), maxInterval);
                    }
                    pollCount++;

                    if (!fs.existsSync(fileJson)) break; 
                    const sesi = JSON.parse(fs.readFileSync(fileJson));
                    
                    // Periksa waktu expired
                    if (Date.now() >= sesi.waktu) {
                        // ... (LOGIKA ROLLBACK STOK SAAT EXPIRED) ...
                        const expiredOrder = await PendingOrder.findOneAndUpdate(
                             { orderId: sesi.orderId, status: "pending" }, 
                             { status: "expired" },
                             { new: true }
                        );
                        
                        if (expiredOrder) {
                            const produkDB = await Produk.findById(expiredOrder.productId);
                            if (produkDB) {
                                const variantDB = produkDB.variants.get(expiredOrder.variantId);
                                if (variantDB) {
                                    // PENGEMBALIAN STOK KE DEPAN ARRAY
                                    variantDB.stok.unshift(...expiredOrder.reservedStock); 
                                    produkDB.markModified('variants');
                                    await produkDB.save();
                                }
                            }
                        }
                        
                        // Hapus pesan QR pembayaran yang expired
                        await deleteQrMessageSafe(sesi.orderId, m.sender);
                        fs.unlinkSync(fileJson);
                        await arap.sendMessage(m.sender, { text: "⏰ Waktu pembayaran habis, pesanan dibatalkan otomatis dan stok dikembalikan." });
                        break;
                    }

                    // Pengecekan via PG Notifications Listener
                    const paid = await checkPaymentViaPG({ totalAmount: sesi.totalBayar, createdAtISO: sesi.createdAtISO, deviceId: process.env.PG_DEVICE_ID || null });
                    if (paid) {
                        // Jika pembayaran diterima
                        
                        // Hapus pesan QR pembayaran
                        await deleteQrMessageSafe(sesi.orderId, m.sender);
                        await sleep(3000); 

                        // --- LOGIKA PENGURANGAN STOK DAN PENAMBAHAN TERJUAL (TRANSACTION) ---
                        const dbSession = await mongoose.startSession();
                        dbSession.startTransaction();

                        let paidOrder = null;

                        try {
                            // 1. UPDATE STATUS KE 'paid'
                            paidOrder = await PendingOrder.findOneAndUpdate(
                                { orderId: sesi.orderId, status: "pending" }, 
                                { status: "paid", paymentMethod: "QRIS_API", paymentDate: new Date() },
                                { new: true, session: dbSession }
                            );

                            if (paidOrder) {
                                // 2. PENGURANGAN STOK DILAKUKAN HANYA JIKA UPDATE STATUS SUKSES
                                const productDB = await Produk.findById(paidOrder.productId).session(dbSession);
                                if (productDB) {
                                    const variantDB = productDB.variants.get(paidOrder.variantId);
                                    if (variantDB) {
                                        // Hapus item stok yang sudah di-reserve (yang ada di depan array)
                                        for (let i = 0; i < paidOrder.jumlah; i++) {
                                            if (variantDB.stok.length > 0) {
                                                variantDB.stok.shift(); // HAPUS ITEM DARI DEPAN ARRAY (FIFO)
                                            }
                                        }
                                        variantDB.terjual = (variantDB.terjual || 0) + paidOrder.jumlah;

                                        productDB.markModified('variants');
                                        await productDB.save({ session: dbSession });
                                    }
                                }
                            }
                            await dbSession.commitTransaction();
                        } catch (txError) {
                            await dbSession.abortTransaction();
                            console.error("[TX-ERROR] Gagal mengurangi stok atau update order:", txError);
                        } finally {
                            dbSession.endSession();
                        }
                        // --- AKHIR LOGIKA STOK ---

                        if (paidOrder) {
                            // ... (Logika Pengiriman Produk SAMA) ...
                            await arap.sendMessage(m.sender, { text: `✅ Pembayaran Rp${toRupiah(sesi.totalBayar)} untuk order ${sesi.orderId} diterima!\nSedang memproses pengiriman produk...` });
                            
                            const reservedStock = paidOrder.reservedStock; 
                            const jumlah = paidOrder.jumlah;
                            let akunTxt = "";
                            let date = moment().tz("Asia/Jakarta");
                            
                            for (const stok of reservedStock) {
                                let [email, pass, profil = "-", pin = "-", fa = "-", harga = "-"] = stok.split("|"); 
                                
                                if (jumlah > 1 && akunTxt.length > 0) {
                                    akunTxt += '• • • • • • • • • • • • • • • •\n';
                                }

                                akunTxt += email ? `• ${email}\n` : ''; 
                                akunTxt += pass ? `• ${pass}\n` : '';
                                akunTxt += profil !== '-' ? `• ${profil}\n` : '';
                                akunTxt += pin !== '-' ? `• ${pin}\n` : '';
                                akunTxt += fa !== '-' ? `• ${fa}\n` : '';
                            }
                            akunTxt = akunTxt.trim();


                            // -- PESAN DETAIL PRODUK --
                            let captionDetail = `╭───〔 *TRANSAKSI SUKSES* 🎉 〕\n\n` +
                                            `• ID TRX: ${paidOrder.orderId}\n\n` +
                                            `╭──〔 *DETAIL PRODUCT* 📦〕 \n` +
                                            `│ • Produk: ${paidOrder.productName} (${paidOrder.variantName})\n` +
                                            `│ • Jumlah Beli: ${jumlah}\n` +
                                            `│ • Total Bayar: Rp ${toRupiah(paidOrder.totalBayar)}\n` +
                                            `│ • Tanggal: ${date.format("DD MMMM YYYY")}\n` +
                                            `│ • Jam: ${date.format("HH:mm:ss")} WIB\n` +
                                            `╰────────\n\n` +
                                            `╭────〔 *SNK PRODUCT* 〕──\n\n` +
                                            `• ${paidOrder.variantSnk || 'Tidak ada Syarat dan Ketentuan.'}\n\n` +
                                            `╰─────────\n\n` +
                                            `Detail akun telah dikirim di pesan berikutnya.`;
                            
                            await arap.sendMessage(m.sender, { text: captionDetail }, { quoted: m }); 
                            
                            await sleep(2000); 
                            
                            // -- PESAN DETAIL AKUN --
                            let captionAkun = `╭────〔 *DETAIL AKUN* 〕──\n\n` +
                                              `${akunTxt}\n\n` +
                                              `╰─────────`;
                            
                            await arap.sendMessage(m.sender, { text: captionAkun }, { quoted: m }); 

                            // Hapus entri PendingOrder yang sudah sukses (KONSISTENSI PENGHAPUSAN DB)
                            await PendingOrder.deleteOne({ orderId: paidOrder.orderId });

                            // Kirim invoice gambar
                            try {
                                const now = new Date();
                                const tanggal = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
                                const invoiceBuffer = await generateInvoiceBuffer({
                                    date: tanggal,
                                    invoiceId: paidOrder.orderId,
                                    status: 'SUCCESS',
                                    product: paidOrder.productName,
                                    variant: paidOrder.variantName,
                                    harga: toRupiah(paidOrder.totalBayar),
                                    buyer: m.sender.split('@')[0],
                                    sn: paidOrder.orderId
                                });
                                await arap.sendMessage(m.sender, { image: invoiceBuffer, caption: 'INVOICE' }, { quoted: m });
                            } catch (e) {
                                console.error('Gagal membuat invoice:', e.message);
                            }
                            
                            // Notif ke owner
                            await arap.sendMessage(owner + "@s.whatsapp.net", {
                                text: `✅ *Transaksi Sukses*\n👤 Dari: @${m.sender.split('@')[0]}\n📦 Produk: ${paidOrder.productName} (${paidOrder.variantName})\n🛒 Jumlah: ${jumlah}\n💰 Total (Inc. Fee): Rp${toRupiah(paidOrder.totalBayar)}\n🧾 Reff ID: ${paidOrder.orderId}`,
                                mentions: [m.sender]
                            });

                        } 

                        // PEMBERSIHAN TOTAL: Hapus file sesi setelah sukses
                        fs.unlinkSync(fileJson);
                        break;
                    }
                } catch (error) {
                    console.error("[BUY-CHECK-MUTASI] Error:", error);
                    if (fs.existsSync(fileJson)) {
                        fs.unlinkSync(fileJson);
                    }
                    break;
                }
            }
        })();

    } catch (error) {
        // ... (Logika Rollback jika Error di Awal SAMA) ...
        await session.abortTransaction();
        session.endSession();
        
        // Hapus file sesi API jika error di tengah proses
        if (fs.existsSync(fileJson)) fs.unlinkSync(fileJson); 
        
        console.error("❌ Gagal memproses 'buy' karena error:", error); 
        return reply("⚠️ Terjadi kesalahan fatal saat memproses pesanan Anda. Silakan coba lagi.");
    }
}
break;

case 'loginorkut': {
  try {
    console.log('[LOGINORKUT DEBUG] Username:', global.username)
    console.log('[LOGINORKUT DEBUG] Password:', global.password)
    console.log('[LOGINORKUT DEBUG] Apikey:', global.apikey)

    if (!global.username || !global.password || !global.apikey)
      return reply(`❌ Data global belum diset!\n\nPastikan sudah menambahkan di *settings.js*:\n\n` +
        `• global.username\n• global.password\n• global.apikey`)

    const url = `https://yzcreative-indol.vercel.app/orderkuota/getotp?apikey=${global.apikey}&username=${encodeURIComponent(global.username)}&password=${encodeURIComponent(global.password)}`
    console.log('[LOGINORKUT DEBUG] URL:', url)

    const res = await fetch(url)
    const data = await res.json().catch(e => ({ error: true, message: 'Gagal parse JSON', raw: e }))
    console.log('[LOGINORKUT DEBUG] Response:', JSON.stringify(data, null, 2))

    if (!data || data.error || !data.status) {
      return reply(`❌ Gagal mendapatkan OTP!\nPeriksa kembali username & password kamu.\n\n📋 Detail: ${data.message || JSON.stringify(data)}`)
    }

    // ✅ Ambil data dengan fallback
    const result = data.result || {}
    const otpMethod = result.otp || data.otp_method || '-'
    const otpValue = result.otp_value || data.otp_value || '-'

    const teks = `
🔐 *GET OTP ORDERKUOTA*
⚙️ Status: ${data.status ? '✅ Berhasil' : '❌ Gagal'}

📧 *Metode OTP:* ${otpMethod}
📩 *Terkirim ke:* ${otpValue}
`.trim()

    await reply(teks)

  } catch (err) {
    console.error('[LOGINORKUT DEBUG] Error:', err)
    await reply(`❌ Terjadi kesalahan saat mengambil OTP.\n${err.message}`)
  }
}
break
case 'verifotp': {
  try {
    if (!q) return reply(`Gunakan format:\n${prefix + command} <kode_otp>\n\nContoh:\n${prefix + command} 56245`);

    // 🔍 Log global
    console.log('[VERIFOTP DEBUG] Username:', global.username)
    console.log('[VERIFOTP DEBUG] Apikey:', global.apikey)
    console.log('[VERIFOTP DEBUG] OTP:', q)

    if (!global.username || !global.apikey)
      return reply(`❌ Data global belum diset!\nPastikan sudah menambahkan:\n\n• global.username\n• global.apikey`)

    // 🌐 URL API Get Token
    const url = `https://yzcreative-indol.vercel.app/orderkuota/gettoken?apikey=${global.apikey}&username=${encodeURIComponent(global.username)}&otp=${encodeURIComponent(q)}`
    console.log('[VERIFOTP DEBUG] URL:', url)

    // 📡 Fetch Data
    const res = await fetch(url)
    const data = await res.json().catch(e => ({ error: true, message: 'Gagal parse JSON', raw: e }))
    console.log('[VERIFOTP DEBUG] Response:', JSON.stringify(data, null, 2))

    // ❗Cek hasil
    if (!data || data.error || !data.status) {
      return reply(`❌ Gagal verifikasi OTP!\n\n📋 Detail:\n${data.message || JSON.stringify(data)}`)
    }

    const r = data.result

    // ✅ Simpan token ke global
    global.tokenorkut = r.token
    console.log('[VERIFOTP DEBUG] Token Disimpan:', global.tokenorkut)

    const teks = `
✅ *VERIFIKASI OTP BERHASIL!*

> Nama Toko : ${r.name}
> Username : ${r.username}
> Saldo : ${r.balance}
> Token : ${r.token}

`.trim()

    await reply(teks)

  } catch (err) {
    console.error('[VERIFOTP DEBUG] Error:', err)
    await reply(`❌ Terjadi kesalahan saat verifikasi OTP.\n${err.message}`)
  }
}
break
case 'garansi': {

    if (isCreator && text.startsWith('garansi-')) {
        const claimIdToView = text.trim();
        try {
            const claim = await WarrantyClaim.findOne({ claimId: claimIdToView });
            if (!claim) return reply(`⚠️ Klaim dengan ID ${claimIdToView} tidak ditemukan.`);

            let detailText = `GARANSI DETAIL: *${claim.claimId}*\n` +
                             `Dari: ${claim.userName} (@${claim.userJid.split('@')[0]})\n` +
                             `Waktu: ${moment(claim.createdAt).tz('Asia/Jakarta').format('DD/MM/YY HH:mm')}\n\n` +
                             `*Alasan Klaim:*\n${claim.claimReason}`;

            if (claim.claimType === 'image') {
                return arap.sendMessage(m.chat, { image: { url: claim.claimContent }, caption: detailText, mentions: [claim.userJid] });
            } else { // claimType === 'text'
                detailText += `\n\n*Isi Klaim (Teks):*\n${claim.claimContent}`;
                return arap.sendMessage(m.chat, { text: detailText, mentions: [claim.userJid] });
            }
        } catch (err) {
            console.error(err);
            return reply('⚠️ Gagal mengambil detail garansi.');
        }
    }


    if (!m.quoted) return reply(`❌ Untuk klaim garansi, silakan reply sebuah GAMBAR atau TEKS bukti dengan perintah:\n*${prefix}${command} [Alasan klaim Anda]*`);
    if (!q) return reply(`❌ Mohon sertakan alasan klaim Anda.\nContoh: *${prefix}${command} Akun tidak bisa login.*`);

    await reply("⏳ Sedang memproses klaim garansi Anda...");

    try {
        const claimId = await getNextClaimId('claimId');
        let newClaimData = {
            claimId: claimId,
            userJid: m.sender,
            userName: pushname,
            claimReason: q,
        };


        if (m.quoted.mtype === 'imageMessage') {
            const media = await m.quoted.download();
            const tempPath = `./temp_${Date.now()}.jpg`;
            fs.writeFileSync(tempPath, media);
            const mediaUrl = await TelegraPh(tempPath);
            fs.unlinkSync(tempPath);

            newClaimData.claimType = 'image';
            newClaimData.claimContent = mediaUrl;
        } else if (m.quoted.text) {
            newClaimData.claimType = 'text';
            newClaimData.claimContent = m.quoted.text;
        } else {
            return reply("❌ Anda hanya bisa me-reply GAMBAR atau TEKS untuk klaim garansi.");
        }

        const newClaim = new WarrantyClaim(newClaimData);
        await newClaim.save();


        const ownerToNotify = global.owner[0];
        if (ownerToNotify) {
            let ownerMsg = `📢 *KLAIM GARANSI BARU*\n\n` +
                           `*ID Klaim:* ${claimId}\n` +
                           `*Dari:* ${pushname} (@${m.sender.split('@')[0]})\n\n` +
                           `Untuk melihat detail, ketik:\n*.garansi ${claimId}*`;
            await arap.sendMessage(ownerToNotify.replace(/[^0-9]/g, '') + '@s.whatsapp.net', { text: ownerMsg, mentions: [m.sender] });
        }

        reply(`✅ Klaim garansi Anda berhasil diajukan dengan ID *${claimId}*.\nMohon tunggu respons dari Admin.`);
    } catch (err) {
        console.error("[GARANSI] Error saat menyimpan klaim:", err);
        reply("⚠️ Gagal mengajukan klaim garansi. Silakan coba lagi.");
    }
}
break;
case 'listgaransi': {
    if (!isCreator) return reply("Fitur khusus Owner!");
    try {
        const allClaims = await WarrantyClaim.find({}).sort({ createdAt: 'asc' });
        if (allClaims.length === 0) return reply('✅ Tidak ada klaim garansi yang aktif saat ini.');

        let listText = '📋 *DAFTAR KLAIM GARANSI AKTIF*\n\n';
        allClaims.forEach(claim => {
            listText += `• *ID:* ${claim.claimId}\n` +
                        `  *Dari:* ${claim.userName}\n` +
                        `  *Waktu:* ${moment(claim.createdAt).tz('Asia/Jakarta').format('DD/MM/YY HH:mm')}\n\n`;
        });
        listText += 'Ketik *.garansi [ID Klaim]* untuk melihat detail.';
        reply(listText);
    } catch (err) {
        console.error(err);
        reply('⚠️ Gagal mengambil daftar garansi.');
    }
}
break;
case 'balasgaransi': {
    if (!isCreator) return reply("Fitur khusus Owner!");

    const isImageReply = m.quoted && m.quoted.mtype === 'imageMessage';
    const args = q.split("|");
    if (args.length < 2) return reply(`❌ Format salah!\nContoh: *${prefix}${command} garansi-1|Teks balasan Anda*`);

    const claimIdToReply = args[0].trim();
    const replyText = args[1].trim();

    try {
        const claim = await WarrantyClaim.findOne({ claimId: claimIdToReply });
        if (!claim) return reply(`⚠️ Klaim dengan ID ${claimIdToReply} tidak ditemukan.`);

        const userJid = claim.userJid;

        const messageToUser = `💬 *Balasan dari Admin terkait Klaim #${claim.claimId}*\n\n` +
                              `${replyText}\n\n` +
                              `Terima kasih.\n\n` +
                              `---\n` +
                              `Balas pesan ini dengan *.balasadmin [pesan Anda]*\n` +
                              `*Ref: ${claim.claimId}*`;

        if (isImageReply) {
            const media = await m.quoted.download();
            await arap.sendMessage(userJid, { image: media, caption: messageToUser });
        } else {
            await arap.sendMessage(userJid, { text: messageToUser });
        }
        
        reply(`✅ Balasan berhasil dikirim ke ${claim.userName} untuk klaim *${claim.claimId}*.`);
    } catch (err) {
        console.error(err);
        reply(`⚠️ Gagal mengirim balasan untuk klaim ${claimIdToReply}.`);
    }
}
break;
case 'balasmember': {
    if (!isCreator) return reply("Fitur khusus Owner!");
    if (!m.quoted) return reply(`❌ Anda harus me-reply pesan dari pelanggan untuk menggunakan perintah ini.`);
    if (!q) return reply(`❌ Mohon tuliskan isi balasan Anda setelah perintah.`);

    try {
        const repliedText = m.quoted.text;
        const match = repliedText.match(/Ref: (garansi-\d+)/);
        if (!match) return reply("⚠️ Pesan yang Anda reply tidak valid atau tidak mengandung ID referensi klaim.");
        
        const claimId = match[1];


        const claim = await WarrantyClaim.findOne({ claimId: claimId });
        if (!claim) return reply(`⚠️ Klaim dengan ID ${claimId} tidak ditemukan di database.`);

        const userJid = claim.userJid;
        const messageToUser = `💬 *Balasan dari Admin terkait Klaim #${claim.claimId}*\n\n` +
                              `${q}\n\n` +
                              `Terima kasih.\n\n` +
                              `---\n` +
                              `Balas pesan ini dengan *.balasadmin [pesan Anda]*\n` +
                              `*Ref: ${claim.claimId}*`;

        await arap.sendMessage(userJid, { text: messageToUser });
        reply(`✅ Balasan berhasil dikirim ke ${claim.userName} untuk klaim *${claim.claimId}*.`);

    } catch (err) {
        console.error("[BALASMEMBER] Error:", err);
        reply("⚠️ Gagal mengirim balasan ke pelanggan.");
    }
}
break;
case 'balasadmin': {
    if (!m.quoted) return reply(`❌ Anda harus me-reply pesan dari admin untuk menggunakan perintah ini.`);
    

    const isImageReply = m.mtype === 'imageMessage';
    const userMessage = q || (isImageReply ? m.message.imageMessage.caption : '');

    if (!userMessage && !isImageReply) {
        return reply(`❌ Mohon tuliskan isi balasan Anda atau kirim sebuah gambar dengan caption.`);
    }

    try {
        const repliedText = m.quoted.text || m.quoted.caption;
        const match = repliedText.match(/Ref: (garansi-\d+)/);
        if (!match) return reply("⚠️ Pesan yang Anda reply tidak valid atau tidak mengandung ID referensi klaim.");

        const claimId = match[1];
        

        const messageForAdmin = `🗣️ *Balasan dari Pelanggan untuk Klaim #${claimId}*\n\n` +
                                `*Dari:* ${pushname} (@${m.sender.split('@')[0]})\n` +
                                `*Isi Pesan:*\n${userMessage || '(Lihat gambar terlampir)'}\n\n` +
                                `---\n` +
                                `Balas pesan ini dengan *.balasmember ${claimId}|[pesan Anda]*\n` +
                                `*Ref: ${claimId}*`;
        
        const ownerToNotify = global.owner[0];
        if (!ownerToNotify) return reply("⚠️ Gagal menghubungi admin saat ini.");

        const ownerJid = ownerToNotify.replace(/[^0-9]/g, '') + '@s.whatsapp.net';


        if (isImageReply) {
            const media = await m.download();
            await arap.sendMessage(ownerJid, { image: media, caption: messageForAdmin, mentions: [m.sender] });
        } else {
            await arap.sendMessage(ownerJid, { text: messageForAdmin, mentions: [m.sender] });
        }
        
        reply("✅ Pesan Anda telah berhasil diteruskan ke Admin. Mohon tunggu balasannya.");

    } catch (err) {
        console.error("[BALASADMIN] Error:", err);
        reply("⚠️ Gagal mengirim balasan ke admin.");
    }
}
break;
case 'donegaransi':
case 'delgaransi': {
    if (!isCreator) return reply("Fitur khusus Owner!");
    if (!q) return reply(`❌ Format salah!\nContoh: *${prefix}${command} garansi-1*`);
    const claimIdToDelete = q.trim();

    try {
        const deletedClaim = await WarrantyClaim.findOneAndDelete({ claimId: claimIdToDelete });
        if (!deletedClaim) return reply(`⚠️ Klaim dengan ID ${claimIdToDelete} tidak ditemukan atau sudah diselesaikan.`);
        
        reply(`✅ Klaim *${claimIdToDelete}* dari pengguna ${deletedClaim.userName} telah ditandai selesai dan dihapus.`);
    } catch (err) {
        console.error(err);
        reply(`⚠️ Gagal menyelesaikan klaim ${claimIdToDelete}.`);
    }
}
break;
            case 'setcodeproduk': {
    if (!isCreator) return reply("Fitur khusus Owner!");

    let data = q.split("|");
    if (data.length < 2) {
        return reply(`❌ Format salah!\nContoh: ${prefix + command} ID_PRODUK_LAMA|ID_PRODUK_BARU`);
    }

    let oldProductId = data[0].trim();
    let newProductId = data[1].trim();

    if (!oldProductId || !newProductId) { 
        return reply(`❌ ID Produk lama dan baru tidak boleh kosong.\nContoh: ${prefix + command} ID_PRODUK_LAMA|ID_PRODUK_BARU`);
    }
    if (oldProductId === newProductId) {
        return reply("⚠️ ID Produk lama dan baru tidak boleh sama.");
    }
    
    try {
        const oldProduct = await Produk.findOne({ id: oldProductId });
        if (!oldProduct) {
            return reply(`⚠️ Produk dengan ID *${oldProductId}* tidak ditemukan.`);
        }

        const existingNewProduct = await Produk.findOne({ id: newProductId });
        if (existingNewProduct) {
            return reply(`⚠️ Produk dengan ID *${newProductId}* sudah ada. Gunakan ID lain.`);
        }


        const { _id, ...oldProductData } = oldProduct.toObject();
        const newProduct = new Produk(oldProductData);
        newProduct.id = newProductId; 
        await newProduct.save();

        await Produk.deleteOne({ id: oldProductId });
        
        reply(`✅ Kode produk berhasil diubah dari *${oldProductId}* menjadi *${newProductId}*.`);

    } catch (err) {
        console.error("❌ Gagal mengupdate kode produk di MongoDB:", err);
        return reply("⚠️ Terjadi kesalahan saat menyimpan perubahan data produk.");
    }
}
break;
            
            case 'setcodevariant': {
    if (!isCreator) return reply("Fitur khusus Owner!");

    let data = q.split("|");
    if (data.length < 2) {
        return reply(`❌ Format salah!\nContoh: ${prefix + command} ID_VARIAN_LAMA|ID_VARIAN_BARU`);
    }

    let oldVariantId = data[0].trim();
    let newVariantId = data[1].trim();

    if (!oldVariantId || !newVariantId) {
        return reply(`❌ ID Varian lama dan baru tidak boleh kosong.\nContoh: ${prefix + command} ID_VARIAN_LAMA|ID_VARIAN_BARU`);
    }
    if (oldVariantId === newVariantId) {
        return reply("⚠️ ID Varian lama dan baru tidak boleh sama.");
    }
    
    try {

        const product = await Produk.findOne({ [`variants.${oldVariantId}.id`]: oldVariantId });

        if (!product) {
            return reply(`⚠️ Varian dengan ID *${oldVariantId}* tidak ditemukan dalam produk manapun.`);
        }


        if (product.variants.get(newVariantId)) {
            return reply(`⚠️ Varian dengan ID *${newVariantId}* sudah ada dalam produk *${product.name}*. Gunakan ID lain.`);
        }


        const oldVariant = product.variants.get(oldVariantId).toObject();


        product.variants.set(newVariantId, { ...oldVariant, id: newVariantId });


        product.variants.delete(oldVariantId);
        

        product.markModified('variants');
        

        await product.save();
        
        reply(`✅ ID varian *${oldVariantId}* pada produk *${product.name}* berhasil diubah menjadi *${newVariantId}*.`);

    } catch (err) {
        console.error("❌ Gagal mengupdate kode varian di MongoDB:", err);
        return reply("⚠️ Terjadi kesalahan saat menyimpan perubahan data produk.");
    }
}
break;
case 'cancelorder': {
    // Pastikan modul yang dibutuhkan tersedia
    const fs = require('fs');
    
    // Tentukan path file JSON
    const idUser = m.sender.split("@")[0];
    const fileJson = `${topupPath}${idUser}.json`; 
    
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        // Cari order berdasarkan userId
        const order = await PendingOrder.findOne({ userId: m.sender }).session(session);
        if (!order) {
            await session.abortTransaction();
            session.endSession();
            
            // Tambahan: Jika tidak ada order di DB, cek apakah ada file JSON yang tersisa.
            if (fs.existsSync(fileJson)) {
                fs.unlinkSync(fileJson);
                return reply("❌ Anda tidak memiliki pesanan yang sedang berlangsung, tetapi sesi lama telah dibersihkan.");
            }
            
            return reply("❌ Anda tidak memiliki pesanan yang sedang berlangsung.");
        }

        // PERHATIAN: Pastikan order yang dibatalkan berstatus 'pending'
        if (order.status !== 'pending') {
             await session.abortTransaction();
             session.endSession();
             // 5. PEMBERSIHAN FILE JSON MESKIPAN STATUS BUKAN PENDING (untuk jaga-jaga)
             if (fs.existsSync(fileJson)) {
                 fs.unlinkSync(fileJson);
             }
             // Hapus juga entri DB yang sudah sukses/selesai
             await PendingOrder.deleteOne({ _id: order._id });
             return reply(`❌ Pesanan ${order.orderId} memiliki status ${order.status.toUpperCase()}. Tidak bisa dibatalkan, tapi sesi telah dibersihkan.`);
        }
        
        // *************************************************************************
        // 1. Rollback Stok (DIHAPUS ATAU DIKOMENTARI)
        // Karena stok di DB tidak berkurang saat order dibuat, kita tidak perlu mengembalikannya.
        // HANYA HAPUS ENTRINYA AGAR RESERVASI HILANG.
        // *************************************************************************
        
        // 2. Hapus Pesan QR
        if (order.qrMessageKey?.id && order.qrMessageChatId) {
            try {
                // Gunakan order.qrMessageChatId sebagai remoteJid
                await arap.sendMessage(order.qrMessageChatId, { delete: order.qrMessageKey });
            } catch (err) { console.error("❌ Gagal hapus pesan QR:", err.message); }
        }

        // 3. Hapus entri dari Database (menghilangkan reservasi)
        await PendingOrder.deleteOne({ _id: order._id }).session(session);
        
        await session.commitTransaction();
        session.endSession();
        
        // 4. Hapus File Sesi JSON
        if (fs.existsSync(fileJson)) {
            fs.unlinkSync(fileJson);
            console.log(`[DEBUG] File sesi JSON ${fileJson} berhasil dihapus.`);
        }
        
        await reply(`✅ Pesanan ${order.orderId} berhasil dibatalkan. Reservasi stok telah dibatalkan.`);

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error("❌ Gagal membatalkan pesanan:", err);
        return reply("⚠️ Terjadi kesalahan saat membatalkan pesanan.");
    }
}
break;



case 'delstok': {
    if (!isCreator) return reply("Fitur khusus Owner!"); 
    if (!q) return reply(`❌ Format salah!\nContoh: ${prefix + command} ID_Varian`);

    let variantId = q.trim();

    try {

        let produkData = await loadProdukData_Rap();
        if (!produkData) {
            return reply("⚠️ Gagal memuat data produk dari database.");
        }

        let variantDataFound = null;
        let variantNameFound = "Unknown Variant";
        let productNameFound = "Unknown Product";
        

        for (const pid in produkData) {
            if (produkData[pid].variants && produkData[pid].variants.get(variantId)) {
                variantDataFound = produkData[pid].variants.get(variantId);
                productNameFound = produkData[pid].name || produkData[pid].id;
                variantNameFound = variantDataFound.name || variantDataFound.id;
                break;
            }
        }

        if (!variantDataFound) {
            return reply(`⚠️ Varian dengan ID *${variantId}* tidak ditemukan dalam produk manapun.`);
        }


        variantDataFound.stok = [];


        const saveSuccess = await saveProdukData_Rap(produkData);
        
        if (saveSuccess) {
            reply(`✅ Berhasil menghapus seluruh stok dari varian *${variantNameFound}* pada produk *${productNameFound}*.`);
        } else {
            reply("⚠️ Gagal menyimpan perubahan data produk.");
        }

    } catch (err) {
        console.error("❌ Gagal menghapus stok:", err);
        return reply("⚠️ Terjadi kesalahan saat memproses permintaan.");
    }
}
break;

case 'addadmin': {
    if (!isCreator) return reply("Fitur ini khusus untuk Owner utama Bot!");

    if (!args[0]) return reply(`❌ Format salah!\nContoh: ${prefix + command} 6281234567890`);

    let nomAdminBaru = args[0].replace(/[^0-9]/g, ''); // Bersihkan nomor dari karakter non-numerik
    if (!nomAdminBaru) return reply("❌ Nomor admin yang dimasukkan tidak valid.");

    if (global.owner.includes(nomAdminBaru)) {
        return reply(`⚠️ Nomor ${nomAdminBaru} sudah menjadi admin.`);
    }

    global.owner.push(nomAdminBaru);

    const settingsFilePath = './settings.js'; 

    try {
        let settingsContent = fs.readFileSync(settingsFilePath, 'utf8');
        
        const newOwnerArrayString = `[${global.owner.map(num => `"${num}"`).join(', ')}]`;

        
        const ownerRegex = /global\.owner\s*=\s*\[([^\]]*)\]/;
        
        if (ownerRegex.test(settingsContent)) {
            settingsContent = settingsContent.replace(ownerRegex, `global.owner = ${newOwnerArrayString}`);
            
            fs.writeFileSync(settingsFilePath, settingsContent, 'utf8');
            
            reply(`✅ Nomor *${nomAdminBaru}* berhasil ditambahkan sebagai admin.\nBot mungkin perlu di-restart agar perubahan pada untuk admin baru sepenuhnya aktif jika ada logika session/cache.`);
            console.log(`Admin baru ditambahkan: ${nomAdminBaru}. File settings.js telah diperbarui.`);
            console.log(`Global owner sekarang: ${JSON.stringify(global.owner)}`);
        } else {

            console.error("[ADDADMIN] Tidak dapat menemukan baris 'global.owner = [...]' yang cocok di settings.js dengan regex.");
            reply("⚠️ Berhasil menambahkan admin ke sesi saat ini, tetapi gagal memperbarui file settings.js secara otomatis. Harap update manual atau periksa format global.owner di settings.js.");

            global.owner.pop();
        }
    } catch (err) {
        console.error("[ADDADMIN] Error saat membaca atau menulis settings.js:", err);
        reply("⚠️ Terjadi kesalahan saat mencoba memperbarui file settings.js. Penambahan admin mungkin hanya berlaku untuk sesi ini.");

        global.owner.pop();
    }
}
break;

case 'deladmin': {
    if (!isCreator) return reply("Fitur ini khusus untuk Owner utama Bot!");

    if (!args[0]) return reply(`❌ Format salah!\nContoh: ${prefix + command} 6281234567890`);

    let nomAdminYangDihapus = args[0].replace(/[^0-9]/g, ''); // Bersihkan nomor
    if (!nomAdminYangDihapus) return reply("❌ Nomor admin yang dimasukkan tidak valid.");


    if (!Array.isArray(global.owner)) {
        console.error("[DELADMIN] global.owner bukan array! Cek settings.js");
        return reply("⚠️ Konfigurasi owner internal bermasalah. Hubungi developer.");
    }

    const adminIndex = global.owner.indexOf(nomAdminYangDihapus);

    if (adminIndex === -1) {
        return reply(`⚠️ Nomor ${nomAdminYangDihapus} tidak ditemukan dalam daftar admin.`);
    }



    if (global.owner.length === 1) {
        return reply("⚠️ Tidak dapat menghapus admin terakhir. Harus ada minimal satu admin.");
    }


    global.owner.splice(adminIndex, 1);


    const settingsFilePath = './settings.js'; 

    try {
        let settingsContent = fs.readFileSync(settingsFilePath, 'utf8');
        
        const newOwnerArrayString = `[${global.owner.map(num => `"${num}"`).join(', ')}]`;
        const ownerRegex = /global\.owner\s*=\s*\[([^\]]*)\]/;
        
        if (ownerRegex.test(settingsContent)) {
            settingsContent = settingsContent.replace(ownerRegex, `global.owner = ${newOwnerArrayString}`);
            fs.writeFileSync(settingsFilePath, settingsContent, 'utf8');
            
            reply(`✅ Nomor *${nomAdminYangDihapus}* berhasil dihapus dari daftar admin.\nBot mungkin perlu di-restart agar perubahan sepenuhnya aktif.`);
            console.log(`Admin dihapus: ${nomAdminYangDihapus}. File settings.js telah diperbarui.`);
            console.log(`Global owner sekarang: ${JSON.stringify(global.owner)}`);
        } else {
            console.error("[DELADMIN] Tidak dapat menemukan baris 'global.owner = [...]' yang cocok di settings.js dengan regex.");
            reply("⚠️ Berhasil menghapus admin dari sesi saat ini, tetapi gagal memperbarui file settings.js secara otomatis. Harap update manual.");

            global.owner.splice(adminIndex, 0, nomAdminYangDihapus); 
        }
    } catch (err) {
        console.error("[DELADMIN] Error saat membaca atau menulis settings.js:", err);
        reply("⚠️ Terjadi kesalahan saat mencoba memperbarui file settings.js. Penghapusan admin mungkin hanya berlaku untuk sesi ini.");

        global.owner.splice(adminIndex, 0, nomAdminYangDihapus);
    }
}
break;

case 'delallproduk': {
    if (!isCreator) return reply("Fitur ini khusus untuk Owner Bot!");

    const konfirmasiArg = "--yakin";
    const argumenPengguna = q.trim().toLowerCase();

    try {

        if (argumenPengguna === konfirmasiArg) {
            

            const result = await Produk.deleteMany({});

            if (result.deletedCount > 0) {
                reply(`✅ Berhasil menghapus *${result.deletedCount}* produk dari database.`);
            } else {
                reply('📦 Tidak ada produk yang ditemukan untuk dihapus.');
            }

        } else {

            const productCount = await Produk.countDocuments({});

            if (productCount === 0) {
                return reply('📦 Tidak ada produk yang tersedia untuk dihapus.');
            }

            let peringatan = "⚠️ *PERINGATAN KERAS!* ⚠️\n\n" +
                             `Anda akan menghapus *SEMUA ${productCount} PRODUK* dari database secara permanen. ` +
                             "Tindakan ini tidak dapat diurungkan.\n\n" +
                             "Untuk melanjutkan, ketik perintah berikut dengan tepat:\n" +
                             `*${prefix}${command} ${konfirmasiArg}*`;
            
            reply(peringatan);
        }
    } catch (err) {
        console.error("[DELALLPRODUK] Error saat menghapus produk dari MongoDB:", err);
        reply("⚠️ Terjadi kesalahan saat mencoba menghapus semua produk.");
    }
}
break;

case 'listadmin': {
    if (!isCreator) return reply("Fitur ini khusus untuk Owner Bot!");

    if (!global.owner || !Array.isArray(global.owner) || global.owner.length === 0) {
        return reply("ℹ️ Saat ini tidak ada nomor admin yang terdaftar di `global.owner`.");
    }

    let teks = "👑 *DAFTAR ADMIN BOT SAAT INI* 👑\n\n`;
    global.owner.forEach((nomor, index) => {

        teks += `${index + 1}. @${nomor}\n`;
    });
    teks += "\nUntuk menambah, gunakan `.addadmin nomor`\nUntuk menghapus, gunakan `.deladmin nomor`";


    const mentionedJids = global.owner.map(nomor => nomor + '@s.whatsapp.net');
    arap.sendMessage(m.chat, {
        text: teks,
        mentions: mentionedJids
    }, { quoted: m });
}
break;

case 'addstok': {
    if (!isCreator) return reply("Fitur khusus Owner!");

    let stockDataLines = [];
    let variantId = "";


    if (m.quoted && m.quoted.mtype === 'documentMessage') {
        const quoted = m.quoted;
        variantId = q.trim();

        if (!variantId) {
            return reply(`❌ Format salah! Jika membalas file, masukkan ID varian.\nContoh: *${prefix + command} ID_VARIAN*`);
        }

        try {
            const fileBuffer = await quoted.download();
            const fileContent = fileBuffer.toString('utf-8');
            stockDataLines = fileContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        } catch (e) {
            console.error("Gagal membaca file:", e);
            return reply("⚠️ Gagal memproses file yang dikirim. Pastikan formatnya benar.");
        }
    } 

    else {
        let data = q.split("|");
        variantId = data[0].trim();

        if (data.length < 2) {
            return reply(`❌ Format salah!\nContoh multi-line:\n*${prefix + command} ID_VARIAN|email|password|2fa|profil|pin*\n*email|password|2fa|profil|pin*\n*email|password*`);
        }
        
        let stockDataString = q.substring(q.indexOf("|") + 1).trim();
        stockDataLines = stockDataString.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    }

    if (stockDataLines.length === 0) {
        return reply("⚠️ Tidak ada data stok yang valid untuk ditambahkan.");
    }

    let produkData = await loadProdukData_Rap();
    if (!produkData) return reply("⚠️ Gagal memuat data produk dari database. Coba lagi.");

    let variantDataFound = null;
    let productName = "";
    let variantName = "";

    for (let pid in produkData) {
        if (produkData[pid].variants && produkData[pid].variants.get(variantId)) {
            variantDataFound = produkData[pid].variants.get(variantId);
            productName = produkData[pid].name;
            variantName = variantDataFound.name;
            break;
        }
    }

    if (!variantDataFound) return reply(`⚠️ Varian dengan Code *${variantId}* tidak ditemukan.`);
    
    const initialStockCount = variantDataFound.stok ? variantDataFound.stok.length : 0;
    
    if (!Array.isArray(variantDataFound.stok)) {
        variantDataFound.stok = [];
    }
    
    let addedCount = 0;
    for (const line of stockDataLines) {
        const [email, password, twofa, profile, pin] = line.split(/[|:]/).map(s => (s ?? '').trim());
        if (email && password) {
            variantDataFound.stok.push(`${email}|${password}|${twofa || ''}|${profile || ''}|${pin || ''}`);
            addedCount++;
        }
    }

    if (addedCount === 0) {
        return reply("⚠️ Tidak ada data stok yang valid. Gunakan format: email|password|[2fa]|[profil]|[pin].");
    }

    const saveSuccess = await saveProdukData_Rap(produkData);
    if (saveSuccess) {
        await reply(`✅ Berhasil menambahkan ${addedCount} unit stok ke varian *${variantName}* (Code: *${variantId}*).\nTotal stok sekarang: ${variantDataFound.stok.length}`);
    } else {

        variantDataFound.stok.splice(initialStockCount, addedCount);
        return reply("⚠️ Gagal menyimpan pembaruan stok ke database.");
    }

    const currentStokTersedia = variantDataFound.stok ? variantDataFound.stok.length : 0;
    
    if (currentStokTersedia > 0) {
        const subscribers = getRestockSubscribers(variantId);
        if (subscribers.length > 0) {
            console.log(`[RESTOCK_NOTIF] Mengirim notifikasi ke ${subscribers.length} pengguna untuk varian ${variantId}`);
            let notifMessage = `✨ RESTOCK ALERT! ✨\n\nSUDAH TERSEDIA KEMBALI!!\n\nProduk *${productName} ${variantName}*\n\n🔐 Code Variant: *${variantId}*\n📦 Stok Tersedia: ${currentStokTersedia}\n\nSegera order dengan ketik:\n*${prefix}buynow ${variantId} jumlah*`;
            
            let successfullyNotified = 0;
            let failedNotified = 0;
            const notificationPromises = [];

            for (const userJid of subscribers) {
                notificationPromises.push(
                    arap.sendMessage(userJid, { text: notifMessage })
                        .then(() => {
                            console.log(`[RESTOCK_NOTIF] Notifikasi terkirim ke ${userJid} untuk ${variantId}`);
                            successfullyNotified++;
                        })
                        .catch(err => {
                            console.error(`[RESTOCK_NOTIF] Gagal mengirim notifikasi ke ${userJid} untuk ${variantId}:`, err);
                            failedNotified++;
                        })
                );
                await sleep(500);
            }

            await Promise.allSettled(notificationPromises);

            await reply(`Notifikasi restock selesai dipicu untuk *${variantName}* (Code: *${variantId}*):\nBerhasil: ${successfullyNotified}\nGagal: ${failedNotified}`);
            
            clearRestockSubscribers(variantId);
        } else {
            await reply(`Tidak ada pengguna yang terdaftar untuk notifikasi restock varian *${variantName}* (Code: *${variantId}*).`);
        }
    } else {
        await reply(`⚠️ Stok untuk varian *${variantName}* (Code: *${variantId}*) masih 0. Notifikasi restock tidak dikirim.`);
    }
}
break;
// Ganti case 'totalcmd' yang lama dengan yang ini di arap.js

case 'totalcmd':
case 'totalcase': {
    if (!isCreator) return reply("Fitur ini khusus untuk Owner Bot!");

    try {
        // 1. Bot membaca file-nya sendiri (arap.js) sebagai teks
        const fileContent = fs.readFileSync(__filename, 'utf8');

        // 2. Gunakan Regular Expression (Regex) untuk mencari semua baris yang cocok dengan pola 'case "nama_perintah":'
        // Pola ini mencari kata 'case', diikuti spasi, diikuti nama perintah di dalam kutip, dan diakhiri dengan ':'
        const commandRegex = /^\s*case\s+['"]([^'"]+)['"]:/gm;
        const matches = fileContent.match(commandRegex);

        // 3. Hitung jumlah kecocokan yang ditemukan
        const commandCount = matches ? matches.length : 0;

        let replyText = `📊 Total perintah (case) yang terdeteksi secara otomatis di file ini adalah: *${commandCount}* perintah.\n\n`;
        replyText += `_Catatan: Jumlah ini menghitung setiap baris 'case', termasuk alias (misal: 'stok' dan 'stock' dihitung terpisah)._`;

        reply(replyText);

    } catch (err) {
        console.error("Gagal membaca file arap.js untuk menghitung command:", err);
        reply("⚠️ Terjadi kesalahan saat mencoba menghitung perintah secara otomatis.");
    }
}
break;
case 'caraorder':
case 'howtoorder': {
    const sapaanNama = pushname ? pushname : "Kak";

    let teksPanduan = `🛍️ Halo *${sapaanNama}*, berikut adalah panduan lengkap cara memesan di bot kami:\n\n`;
    teksPanduan += `*LANGKAH 1: LIHAT PRODUK & KODE VARIAN*\n\n`;
    teksPanduan += `1️⃣ Ketik *${prefix}listproduk* atau *${prefix}stok* untuk melihat daftar produk utama yang diberi nomor.\n\n`;
    teksPanduan += `2️⃣ Setelah daftar muncul, balas dengan mengetik *nomor urut produk* yang Anda inginkan (Contoh: *1*).\n\n`;
    teksPanduan += `3️⃣ Bot akan menampilkan detail semua varian dari produk tersebut. Perhatikan *Code Variant* untuk setiap varian (Contoh: \`netf1u\`, \`ytfh\`), karena kode ini akan digunakan untuk memesan.\n\n`;
    teksPanduan += `-----------------------------------\n\n`;
    teksPanduan += `*LANGKAH 2: LAKUKAN PEMESANAN*\n\n`;
    teksPanduan += `Anda bisa memilih salah satu dari dua cara pembayaran:\n\n`;
    teksPanduan += `*A. BAYAR LANGSUNG (QRIS)*\n`;
    teksPanduan += `Gunakan perintah ini untuk pembayaran langsung via QRIS.\n\n`;
    teksPanduan += `┌─「 Format Perintah 」\n`;
    teksPanduan += `│ \`\`\`${prefix}buynow [Code Variant] [Jumlah]\`\`\`\n`;
    teksPanduan += `└─\n`;
    teksPanduan += `*Contoh:* \`\`\`${prefix}buynow netf1u 1\`\`\`\n\n`;
    teksPanduan += `Bot akan mengirimkan gambar QRIS ke chat pribadi Anda. Segera selesaikan pembayaran sesuai nominal yang tertera sebelum kedaluwarsa.\n\n`;
    teksPanduan += `*B. BAYAR DENGAN SALDO AKUN* (Lebih Cepat & Praktis)\n`;
    teksPanduan += `Beli langsung menggunakan saldo yang Anda miliki di bot.\n\n`;
    teksPanduan += `   1. Cek saldo Anda: *${prefix}ceksaldo*\n`;
    teksPanduan += `   2. Jika kurang, isi saldo: *${prefix}deposit [jumlah]* (Contoh: \`${prefix}deposit 10000\`)\n`;
    teksPanduan += `   3. Lakukan pembelian:\n`;
    teksPanduan += `   ┌─「 Format Perintah 」\n`;
    teksPanduan += `   │ \`\`\`${prefix}orders [Code Variant] [Jumlah]\`\`\`\n`;
    teksPanduan += `   └─\n`;
    teksPanduan += `   *Contoh:* \`\`\`${prefix}orders netf1u 1\`\`\`\n\n`;
    teksPanduan += `-----------------------------------\n\n`;
    teksPanduan += `*STOK HABIS?*\n\n`;
    teksPanduan += `Jika varian yang Anda inginkan habis, Anda bisa meminta notifikasi saat stok kembali tersedia.\n\n`;
    teksPanduan += `┌─「 Format Perintah 」\n`;
    teksPanduan += `│ \`\`\`${prefix}restok [Code Variant]\`\`\`\n`;
    teksPanduan += `└─\n`;
    teksPanduan += `*Contoh:* \`\`\`${prefix}restok netf1u\`\`\`\n\n`;
    teksPanduan += `Terima kasih & Selamat Berbelanja! 😊`;

    await reply(teksPanduan);
}
break;

case 'stok':
case 'stock':
case 'listproduk':
case 'produk': {

    let produkData = await loadProdukData_Rap();

    if (Object.keys(produkData).length === 0) {
        return reply("📦 Belum ada produk yang tersedia.");
    }
    

    const sortedProduk = Object.values(produkData).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (sortedProduk.length === 0) return reply("📦 Belum ada produk yang tersedia.");

    let teks = `Halo ${pushname} 👋🏼.\n\nketik *#caraorder* mengetahui cara melakukan pembelian!\n\nberikut list produk yang tersedia di bot auto order ini.\n\n╭═┅═━━━━━━━━☉\n┊\n`;

    sortedProduk.forEach((produk, index) => {
        teks += `┊ [ ${index + 1} ] ${produk.name}\n`;
    });

    teks += `┊\n╰═┅═━━━━━━━━☉\n\nᴋᴇᴛɪᴋ ɴᴏᴍᴏʀ ᴘʀᴏᴅᴜᴋ ᴅɪᴀᴛᴀꜱ ᴜɴᴛᴜᴋ ᴍᴇʟɪʜᴀᴛ ᴅᴇᴛᴀɪʟ ᴘʀᴏᴅᴜᴋ.\n*CONTOH: 1*`;

    reply(teks);
}
break;
                

                
            default:
                if (!m.fromMe && (budy) && !isNaN(budy)) { 

    }
    if (!m.fromMe && (budy) && typeof budy === 'string') { 

    }
       if ((budy) && !isNaN(budy)) {
        let produkData = await loadProdukData_Rap();

        if (Object.keys(produkData).length === 0) {
            return reply("⚠️ Produk tidak ditemukan.");
        }

        let sortedProduk = Object.values(produkData).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        let index = parseInt(budy) - 1;

        if (index < 0 || index >= sortedProduk.length) {
            return reply("⚠️ Produk tidak ditemukan.");
        }

        let produk = sortedProduk[index];

        let teks = `╭─────────────✧\n`;
        teks += `┊・ Produk: ${produk.name}\n`;
        teks += `┊・ Desk: ${produk.desc}\n`;

        let totalTerjual = 0;

        if (produk.variants && produk.variants.size > 0) {
            totalTerjual = Array.from(produk.variants.values()).reduce((acc, v) => acc + (v.terjual || 0), 0);
        }
        teks += `┊・ Total Stok Terjual: ${totalTerjual}\n`;
        teks += `╰─────────────✧\n\n`;

        if (produk.variants && produk.variants.size > 0) {
            teks += `╭─────────────✧\n┊ *VARIASI, HARGA & STOK:*\n╰─────────────✧\n\n⚠️ Jika stok variant habis.\nKetik: *restok code*\n\n`;

            const sortedVariants = Array.from(produk.variants.values())
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            sortedVariants.forEach(variant => {
                teks += `╭─────────────✧\n`;
                teks += `・ *${variant.name}*\n`;
                teks += `┊・🏷️| Harga: Rp ${toRupiah(getHargaSetelahDiskon(variant))}\n`;
                teks += `┊・📦| Stok Tersedia: ${variant.stok.length}\n`;
                teks += `┊・🧾| Stok Terjual: ${variant.terjual || 0}\n`;
                teks += `┊・🔐| Code Variant: *${variant.id}*\n`;
                teks += `┊・📑| Deskripsi: ${variant.desc}\n`;
                teks += `╰─────────────✧\n\n`;
            });
        } else {
            teks += `🚫 Produk ini tidak memiliki varian.\n`;
        }

        teks += `\n🛒 Untuk membeli ketik:\n*beli (code variant) (jumlah)*`;

        return reply(teks);
    }
    if ((budy) && typeof budy === 'string') {
        let produkData = await loadProdukData_Rap();

        if (Object.keys(produkData).length === 0) {
            return;
        }

        for (let produk of Object.values(produkData)) {

            if (produk.variants && produk.variants.get(budy)) { 
                let variant = produk.variants.get(budy); 

                let teks = `╭─────────────✧\n┊・ ${produk.name}\n╰─────────────✧\n\n⚠️ Jika stok variant habis.\nKetik: *restok ${budy}*\n\n*[・] ${variant.name}*\n`;
                teks += `╭─────────────✧\n`;
                teks += `┊・🏷️| Harga: Rp ${toRupiah(getHargaSetelahDiskon(variant))}\n`;
                teks += `┊・📦| Stok Tersedia: ${variant.stok.length}\n`;
                teks += `┊・🧾| Stok Terjual: ${variant.terjual || 0}\n`;
                teks += `┊・📑| Deskripsi: ${variant.desc}\n`;
                teks += `╰─────────────✧\n\n`;
                teks += `🛒 Untuk membeli ketik: *${prefix}buynow ${budy} (jumlah)*`;

                return reply(teks);
            }
        }
    }

    if (budy.startsWith('>')) {
        if (!isCreator) return;
        try {
            let evaled = await eval(budy.slice(2));
            if (typeof evaled !== 'string') evaled = require('util').inspect(evaled);
            await m.reply(evaled);
        } catch (err) {
            await m.reply(util.format(err));
        }
    }



if (budy.startsWith('>')) {
                    if (!isCreator) return
                    try {
                        let evaled = await eval(budy.slice(2))
                        if (typeof evaled !== 'string') evaled = require('util').inspect(evaled)
                        await m.reply(evaled)
                    } catch (err) {
                        await m.reply(util.format(err))
                    }
                }
       }
        
    } catch (err) {
        m.reply(util.format(err))
    }
}
