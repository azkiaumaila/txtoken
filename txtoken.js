const { ethers } = require("ethers");
require("dotenv").config();
const fs = require("fs");

// Ambil konfigurasi dari .env
const PRIVATE_KEYS = process.env.PRIVATE_KEYS ? process.env.PRIVATE_KEYS.split(",") : [];
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS; // Alamat kontrak token ERC-20
const RPC_URL = process.env.RPC_URL || "https://rpc.sepolia.org"; // RPC URL jaringan
const GAS_TOKEN = process.env.GAS_TOKEN || "ETH"; // Token untuk gas fee

if (!PRIVATE_KEYS.length || !TOKEN_ADDRESS) {
    console.error("Harap isi PRIVATE_KEYS dan TOKEN_ADDRESS di file .env");
    process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallets = PRIVATE_KEYS.map(privateKey => new ethers.Wallet(privateKey.trim(), provider));

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

// Fungsi untuk mengirim token ERC-20
const sendToken = async (fromWallet, toAddress, tokenContract, amount) => {
    try {
        const tx = await tokenContract.connect(fromWallet).transfer(toAddress, amount, {
            gasLimit: 100000, // Batas gas, sesuaikan jika diperlukan
            gasPrice: await provider.getFeeData().then(data => data.gasPrice), // Gas price dinamis
        });
        await tx.wait();
        return tx;
    } catch (error) {
        console.error("Error saat mengirim token:", error);
        throw error;
    }
};

(async () => {
    const addressesFile = "addresses.txt";
    const addresses = readAddressesFromFile(addressesFile);

    if (addresses.length === 0) {
        console.error("Tidak ada alamat yang ditemukan di file.");
        process.exit(1);
    }

    if (addresses.length > 1000) {
        console.warn("Daftar alamat melebihi 1000. Hanya akan memproses 1000 alamat pertama.");
        addresses.splice(1000); // Batasi ke 1000 alamat
    }

    // Inisialisasi kontrak token
    const tokenContract = new ethers.Contract(
        TOKEN_ADDRESS,
        ["function transfer(address to, uint256 amount) public returns (bool)"],
        provider
    );

    const amountToSend = ethers.parseUnits("10000", 18); // 10,000 token dengan 18 desimal

    console.log(`Mengirim ${ethers.formatUnits(amountToSend, 18)} token ke setiap alamat...`);

    for (let i = 0; i < addresses.length; i++) {
        const toAddress = addresses[i];
        const walletIndex = i % wallets.length; // Rotasi antara wallets

        if (!ethers.isAddress(toAddress)) {
            console.error(`Alamat ${toAddress} tidak valid. Melewati...`);
            continue;
        }

        const wallet = wallets[walletIndex];

        try {
            console.log(`Mengirim ${ethers.formatUnits(amountToSend, 18)} token dari wallet ${walletIndex} ke ${toAddress}...`);
            const tx = await sendToken(wallet, toAddress, tokenContract, amountToSend);
            console.log(`Transaksi berhasil. Tx Hash: ${tx.hash}`);

            // Jeda acak antara 10-30 detik
            const delay = Math.floor(Math.random() * (30000 - 10000 + 1)) + 10000; // 10-30 detik
            console.log(`Menunggu ${delay/1000} detik sebelum transaksi berikutnya...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        } catch (error) {
            console.error(`Gagal mengirim ke ${toAddress} dari wallet ${walletIndex}:`, error);
            // Coba lagi setelah jeda 60 detik
            await new Promise(resolve => setTimeout(resolve, 60000)); // Jeda 60 detik sebelum retry
            continue;
        }
    }

    console.log("Semua transaksi selesai.");
})();
