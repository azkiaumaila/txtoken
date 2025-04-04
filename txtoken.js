const { ethers } = require("ethers");
require("dotenv").config();
const fs = require("fs");

// Ambil private key dari .env
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const TEA_RPC_URL = "https://tea-sepolia.g.alchemy.com/public";

if (!PRIVATE_KEY) {
    console.error("Harap isi PRIVATE_KEY di file .env");
    process.exit(1);
}

const provider = new ethers.JsonRpcProvider(TEA_RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Fungsi untuk membaca alamat dari file
const readAddressesFromFile = (filePath) => {
    try {
        const addresses = fs.readFileSync(filePath, "utf8").split("\n").map(line => line.trim()).filter(line => line.length > 0);
        return addresses;
    } catch (error) {
        console.error("Gagal membaca file alamat:", error);
        process.exit(1);
    }
};

// Fungsi untuk menghasilkan jumlah token acak antara 0.05 dan 0.2 TEA
const getRandomAmount = () => {
    const min = 0.0035; // Minimum 0.05 TEA
    const max = 0.027;  // Maksimum 0.2 TEA
    return ethers.parseEther((Math.random() * (max - min) + min).toFixed(5));
};

// Fungsi untuk menghasilkan jeda acak antara 60 dan 100 detik
const getRandomDelay = () => {
    const minDelay = 90 * 1000; // 60 detik dalam milidetik
    const maxDelay = 145 * 1000; // 100 detik dalam milidetik
    return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
};

// Fungsi untuk mengecek dan menunggu jeda 24 jam jika sudah 200 transaksi
let transactionCount = 0; // Counter global untuk melacak jumlah transaksi
const checkTransactionLimit = async () => {
    const MAX_TRANSACTIONS = 500; // Batas 200 transaksi (bisa diubah menjadi 150)
    const DELAY_24H = 24 * 60 * 60 * 1000; // 24 jam dalam milidetik

    if (transactionCount >= MAX_TRANSACTIONS) {
        console.log(`Batas ${MAX_TRANSACTIONS} transaksi tercapai. Menunggu 24 jam sebelum melanjutkan...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_24H));
        transactionCount = 0; // Reset counter setelah 24 jam
    }
};

// Fungsi untuk mengirim TEA ke daftar alamat dari file dengan jeda
const sendTeaFromFile = async (addresses) => {
    for (let address of addresses) {
        await checkTransactionLimit(); // Cek batas transaksi sebelum setiap transaksi

        if (!ethers.isAddress(address)) {
            console.error(`Alamat ${address} tidak valid. Melewati...`);
            continue;
        }

        const amount = getRandomAmount();
        const delay = getRandomDelay();

        try {
            const tx = await wallet.sendTransaction({
                to: address,
                value: amount,
            });

            const amountInEther = ethers.formatEther(amount);
            console.log(`Mengirim ${amountInEther} TEA ke ${address}. Tx Hash: ${tx.hash}`);
            await tx.wait();

            transactionCount++; // Tambah counter transaksi
            console.log(`Transaksi ke-${transactionCount} selesai. Menunggu ${delay/1000} detik untuk transaksi berikutnya...`);

            // Tunggu jeda acak sebelum transaksi berikutnya
            await new Promise(resolve => setTimeout(resolve, delay));
        } catch (error) {
            console.error(`Error saat mengirim ke ${address}:`, error);
            // Tunggu jeda sebelum mencoba lagi
            await new Promise(resolve => setTimeout(resolve, delay));
            continue; // Lanjut ke alamat berikutnya
        }
    }

    // Setelah semua alamat diproses, simpan log
    if (transactionCount > 0) {
        fs.writeFileSync("sent_addresses.txt", addresses.filter(addr => ethers.isAddress(addr)).join("\n"), "utf8");
        console.log("Daftar alamat yang sudah dikirim token disimpan di 'sent_addresses.txt'");
    }
};

(async () => {
    const addressesFile = "addresses.txt"; // Nama file yang berisi daftar alamat
    const addresses = readAddressesFromFile(addressesFile);

    if (addresses.length === 0) {
        console.error("Tidak ada alamat yang ditemukan di file.");
        process.exit(1);
    }

    console.log("Daftar alamat yang akan dikirim token:", addresses);

    await sendTeaFromFile(addresses);
})();
