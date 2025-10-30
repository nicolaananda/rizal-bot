const fs = require('fs')
require('dotenv').config()

global.mongodblink = process.env.MONGODB_URI || "mongodb+srv://bisnisrizal17:yzcreative123@cluster0.otz40gs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"; // ambil dari env, fallback ke default
global.angka= "2151125";
global.proxy = process.env.PROXY_URL || "http://ivalproxy-zone-custom-region-ID-asn-AS24203:proxyival2aug@asg.360s5.com:3600"; //link proxy http residental

global.pairing = true // ganti false kalo mau pake qr dan ganti true kalo mau pake pairing atau bisa diubah di file main.js
global.namabot = "YZ-Botz"
global.namaowner = "Yaelahzal"
global.footer_text = "v1"
global.pp_bot = fs.readFileSync("./image/Sejeong.jpg")
global.qris = fs.readFileSync("./image/qris.jpg")
global.owner = ["6281227029620", "6282124359181","6285143569870","6281389592985"]
global.sessionName = 'session'

// ORKUT SETTINGS
global.password = process.env.ORKUT_PASSWORD || '230722adjie'
global.username = process.env.ORKUT_USERNAME || 'yzcreative'
global.tokenorkut = process.env.ORKUT_TOKEN || '2151125:Arg6pwtWhXsnkBOM5Lqx2UlZT4id9ae8'
global.apikey = process.env.API_KEY || 'yzcreative'

global.prefa = ['-_-']
global.caption_pay = `Qris All Pay
Ovo
Dana
Gopay

Mau ganti payment? ketik .setpay
`
//menu bot rapihin sendiri ya, belajar lah jadi anak mandiri.
module.exports.helpMenu = (pushname) =>{
  return `Halo ${pushname} 👋🏼.
  
berikut list menu yang tersedia di bot ini.

╭───「 ORDER MENU 」
┊ [ 1 ] stok
┊ [ 2 ] stock
┊ [ 3 ] liststok
┊ [ 4 ] produk
┊ [ 5 ] listproduk
┊ [ 6 ] ceksaldo
┊ [ 7 ] buynow ( tanpa deposit )
┊ [ 8 ] buy ( tanpa deposit )
┊ [ 9 ] order ( tanpa deposit )
┊ [ 10 ] deposit ( deposit saldo )
┊ [ 11 ] orders ( beli pakai saldo )
┊ [ 12 ] cancelorder
┊ [ 13 ] caraorder (howtoorder)
┊ [ 14 ] restok (notifrestok)
┊ [ 15 ] ceksaldo (saldo)
┊ [ 16 ] setnamaakun (setnamasaya)
┊ [ 17 ] garansi (klaimgaransi)
╰──────

╭───「 OWNER MENU 」
┊ [ 18 ] addproduk
┊ [ 19 ] delproduk
┊ [ 20 ] setcodeproduk
┊ [ 21 ] setdeskproduk
┊ [ 22 ] setnamaproduk
┊ [ 23 ] addvariant
┊ [ 24 ] delvariant
┊ [ 25 ] setcodevariant
┊ [ 26 ] setdeskvariant
┊ [ 27 ] setnamavariant
┊ [ 28 ] setsnkvariant
┊ [ 29 ] sethargavariant
┊ [ 30 ] setterjual
┊ [ 31 ] listkode ( code produk )
┊ [ 32 ] delallproduk
┊ [ 33 ] addstok
┊ [ 34 ] delstok
┊ [ 35 ] getstok (orderadmin)
┊ [ 36 ] orderadmin (getstok) 
┊ [ 37 ] cekdataakun (getdatavariant)
┊ [ 38 ] editstok
┊ [ 39 ] addsaldo
┊ [ 40 ] kurangisaldo
┊ [ 41 ] topsaldo (topbalance)
┊ [ 42 ] listsaldo
┊ [ 43 ] addadmin
┊ [ 44 ] deladmin
┊ [ 45 ] listadmin
┊ [ 46 ] broadcast
┊ [ 47 ] clearpending
┊ [ 48 ] profit (totalprofit, totalpenjualan)
┊ [ 49 ] profitharian
┊ [ 50 ] profitmingguan
┊ [ 51 ] profitbulanan
┊ [ 52 ] setmerchantid
┊ [ 53 ] setapikeyorkut
┊ [ 54 ] setcodeqr
╰──────

╭═┅═━━━━━━━━☉
┊
┊ [ 55 ] owner 
┊ [ 56 ] addsewa 
┊ [ 57 ] delsewa 
┊ [ 58 ] ceksewa 
┊ [ 59 ] listsewa 
┊ [ 60 ] list 
┊ [ 61 ] addlist 
┊ [ 62 ] updatelist 
┊ [ 63 ] renamelist 
┊ [ 64 ] dellist 
┊ [ 65 ] jeda 
┊ [ 66 ] tambah 
┊ [ 67 ] kurang 
┊ [ 68 ] kali 
┊ [ 69 ] bagi 
┊ [ 70 ] setproses 
┊ [ 71 ] changeproses 
┊ [ 72 ] delsetproses 
┊ [ 73 ] setdone 
┊ [ 74 ] changedone 
┊ [ 75 ] delsetdone 
┊ [ 76 ] proses 
┊ [ 77 ] done 
┊ [ 78 ] welcome 
┊ [ 79 ] goodbye 
┊ [ 80 ] setwelcome 
┊ [ 81 ] changewelcome 
┊ [ 82 ] delsetwelcome 
┊ [ 83 ] setleft 
┊ [ 84 ] changeleft 
┊ [ 85 ] delsetleft 
┊ [ 86 ] antiwame 
┊ [ 87 ] antiwame2 
┊ [ 88 ] antilink 
┊ [ 89 ] antilink2 
┊ [ 90 ] open 
┊ [ 91 ] close 
┊ [ 92 ] hidetag 
┊ [ 93 ] add 
┊ [ 94 ] kick 
┊ [ 95 ] stiker 
┊ [ 96 ] setppgc 
┊ [ 97 ] setnamegc 
┊ [ 98 ] setdesgc 
┊ [ 99 ] linkgc 
┊ [ 100 ] resetlinkgc 
┊ [ 101 ] promote 
┊ [ 102 ] demote 
┊ [ 103 ] setbot 
┊ [ 104 ] updatesetbot 
┊ [ 105 ] delsetbot 
┊ [ 106 ] bot 
┊
╰═┅═━━━━━━━━☉
`
}