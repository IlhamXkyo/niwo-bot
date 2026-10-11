// plugins/maker/fakebca.js
// Dashboard SIMULASI / DEMO
// Tidak menggunakan node-fetch

import {
    createCanvas,
    loadImage,
    GlobalFonts
} from '@napi-rs/canvas'

import {
    writeFile,
    mkdir,
    unlink
} from 'node:fs/promises'

import {
    existsSync
} from 'node:fs'

import {
    join
} from 'node:path'


const config = {
    name: 'fakebca',
    aliases: ['fkebca', 'bcademo'],
    category: 'maker',
    description: 'Membuat dashboard rekening simulasi',
    usage: '.fakebca <nama>|<norek>|<saldo>',
    cooldown: 5,
    energi: 0
}


/*
 * Download menggunakan fetch bawaan Node.js.
 * Tidak membutuhkan package node-fetch.
 */
async function downloadFile(url, filePath) {
    const response = await fetch(url)

    if (!response.ok) {
        throw new Error(
            `Gagal mengambil file (${response.status} ${response.statusText})`
        )
    }

    const buffer = Buffer.from(
        await response.arrayBuffer()
    )

    await writeFile(
        filePath,
        buffer
    )
}


/*
 * Plugin Handler bot
 */
async function handler(m, { sock, text }) {

    if (!text) {
        return m.reply(
            `*Format salah!*\n\n` +
            `Contoh:\n` +
            `.fakebca RIN IMUP|111 - 222 - 3333|1,000,000`
        )
    }


    const parts = text.split('|')

    if (parts.length < 3) {
        return m.reply(
            `*Format salah!*\n\n` +
            `Gunakan format:\n` +
            `.fakebca Nama|No Rek|Saldo`
        )
    }


    const txtNama = parts[0]
        .trim()
        .toUpperCase()

    const txtRek = parts[1]
        .trim()

    const txtSaldo = parts
        .slice(2)
        .join('|')
        .trim()


    if (!txtNama || !txtRek || !txtSaldo) {
        return m.reply(
            `❌ Nama, nomor rekening, dan saldo wajib diisi.`
        )
    }


    const ASSETS_DIR = join(
        process.cwd(),
        'assets',
        'bcadash'
    )

    const FONTS_DIR = join(
        ASSETS_DIR,
        'fonts'
    )

    const TMP_DIR = join(
        process.cwd(),
        'tmp'
    )

    const BG_LOCAL = join(
        ASSETS_DIR,
        'demo-dashboard.png'
    )


    /*
     * Template hanya digunakan sebagai background.
     * Hasil akhir diberi watermark SIMULASI.
     */
    const BG_URL =
        'https://raw.githubusercontent.com/ryyntwx/allimagerin/refs/heads/main/F1.png'


    try {

        await m.reply(
            `⏳ *Memproses dashboard simulasi...*`
        )


        /*
         * Buat folder jika belum ada
         */
        await mkdir(
            FONTS_DIR,
            {
                recursive: true
            }
        )

        await mkdir(
            TMP_DIR,
            {
                recursive: true
            }
        )


        /*
         * Font
         */
        const fontConfigs = [

            {
                url:
                    'https://fonts.gstatic.com/s/poppins/v23/pxiByp8kv8JHgFVrLEj6Z1xlFQ.woff2',

                file:
                    'Poppins-SemiBold.ttf',

                family:
                    'PoppinsDemo'
            },

            {
                url:
                    'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff2',

                file:
                    'Inter-Medium.ttf',

                family:
                    'InterDemo'
            },

            {
                url:
                    'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2',

                file:
                    'Inter-Bold.ttf',

                family:
                    'InterBoldDemo'
            }

        ]


        /*
         * Download dan register font
         */
        for (const font of fontConfigs) {

            const fontPath = join(
                FONTS_DIR,
                font.file
            )


            if (!existsSync(fontPath)) {

                await downloadFile(
                    font.url,
                    fontPath
                )

            }


            GlobalFonts.registerFromPath(
                fontPath,
                font.family
            )

        }


        /*
         * Download background
         */
        if (!existsSync(BG_LOCAL)) {

            await downloadFile(
                BG_URL,
                BG_LOCAL
            )

        }


        /*
         * Load background
         */
        const bg = await loadImage(
            BG_LOCAL
        )


        const canvas = createCanvas(
            bg.width,
            bg.height
        )


        const ctx =
            canvas.getContext('2d')


        ctx.drawImage(
            bg,
            0,
            0,
            canvas.width,
            canvas.height
        )


        /*
         * =====================================
         * DATA
         * =====================================
         */

        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'


        // Nama
        ctx.fillStyle = '#FFFFFF'

        ctx.font =
            '600 27px PoppinsDemo'

        ctx.fillText(
            txtNama,
            127,
            56
        )


        // Nomor rekening
        ctx.fillStyle = '#FFFFFF'

        ctx.font =
            '500 28px InterDemo'

        ctx.fillText(
            txtRek,
            211,
            219
        )


        // Saldo
        ctx.fillStyle = '#4F4F4F'

        ctx.font =
            '700 43px InterBoldDemo'

        ctx.fillText(
            txtSaldo,
            156,
            361
        )


        /*
         * =====================================
         * WATERMARK SIMULASI
         * =====================================
         */

        ctx.save()


        ctx.translate(
            canvas.width / 2,
            canvas.height / 2
        )


        ctx.rotate(
            -Math.PI / 6
        )


        ctx.globalAlpha = 0.4

        ctx.fillStyle =
            '#FF0000'


        ctx.font =
            '700 70px InterBoldDemo'


        ctx.textAlign =
            'center'


        ctx.textBaseline =
            'middle'


        ctx.fillText(
            'SIMULASI / DEMO',
            0,
            0
        )


        ctx.restore()


        /*
         * File output
         */
        const outPath = join(
            TMP_DIR,
            `fakebca-${Date.now()}.png`
        )


        await writeFile(
            outPath,
            await canvas.encode('png')
        )


        /*
         * Kirim gambar
         */
        await sock.sendMessage(
            m.chat,
            {
                image: {
                    url: outPath
                },

                caption:
                    `✅ *Dashboard Simulasi*\n\n` +

                    `👤 *Nama:* ${txtNama}\n` +

                    `💳 *No. Rek:* ${txtRek}\n` +

                    `💰 *Saldo:* Rp ${txtSaldo}\n\n` +

                    `⚠️ *SIMULASI / DEMO*\n` +
                    `Bukan bukti transaksi resmi.`
            },

            {
                quoted: m
            }
        )


        /*
         * Hapus file temporary
         */
        if (existsSync(outPath)) {

            await unlink(
                outPath
            )

        }


    } catch (error) {

        console.error(
            '[FAKEBCA ERROR]',
            error
        )


        return m.reply(
            `❌ *Gagal membuat gambar!*\n\n` +
            `${error.message}`
        )

    }

}


export default {
    config,
    handler
}