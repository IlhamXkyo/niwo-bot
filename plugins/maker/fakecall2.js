// plugins/maker/fakecall2.js
// Fake Call : SIMULASI / DEMO
// Format ESM untuk Niwo Bot

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
    existsSync,
    readFileSync
} from 'node:fs'

import {
    join
} from 'node:path'

import axios from 'axios'


const config = {
    name: 'fakecall2',
    aliases: ['fakecal'],
    category: 'maker',
    description: 'Membuat gambar panggilan simulasi',
    usage: '.fakecall2 <nama> | <durasi>',
    cooldown: 5,
    energi: 0
}


async function downloadFile(url, filePath) {
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
            'User-Agent': 'Mozilla/5.0'
        }
    })

    await writeFile(
        filePath,
        Buffer.from(response.data)
    )
}


async function handler(m, { sock, text, command }) {

    const q = m.quoted || m

    const mime =
        (q.msg || q).mimetype || ''


    /*
     * Harus reply gambar
     */
    if (!/image/.test(mime)) {
        return m.reply(
            `*Format salah!*\n\n` +
            `Silahkan reply/balas foto yang mau dijadikan ` +
            `foto profil dengan caption:\n\n` +
            `.${command} Sayangku | 01:32:04`
        )
    }


    /*
     * Cek input
     */
    if (!text) {
        return m.reply(
            `*Format salah!*\n\n` +
            `Masukkan teks nama dan durasi!\n\n` +
            `Contoh:\n` +
            `.${command} Sayangku | 01:32:04`
        )
    }


    const parts = text.split('|')


    if (parts.length < 2) {
        return m.reply(
            `*Format salah!*\n\n` +
            `Pastikan menggunakan pemisah tanda garis (|)\n\n` +
            `Contoh:\n` +
            `.${command} Sayangku | 01:32:04`
        )
    }


    const txtNama =
        parts[0].trim()


    const txtDurasi =
        parts.slice(1).join('|').trim()


    if (!txtNama || !txtDurasi) {
        return m.reply(
            `❌ Nama dan durasi wajib diisi.`
        )
    }


    const ASSETS_DIR = join(
        process.cwd(),
        'assets',
        'wacall_meme'
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
        'template_call_new.png'
    )


    const BG_URL =
        'https://raw.githubusercontent.com/ryyntwx/allimagerin/refs/heads/main/3b1a98bd-2ebd-4035-a645-f42556300408.png'


    const APPLE_EMOJI_JSON_URL =
        'https://media.githubusercontent.com/media/Ditzzx-vibecoder/entahlah/main/emoji-apple.json'


    const APPLE_EMOJI_JSON_LOCAL =
        join(
            FONTS_DIR,
            'emoji-apple-image.json'
        )


    try {

        await m.reply(
            '⏳ *Memproses Fake Call simulasi...*'
        )


        /*
         * Buat folder
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
                    'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4AMP6lQ.woff2',

                name:
                    'Roboto-Bold.ttf',

                family:
                    'RobotoWA'
            },

            {
                url:
                    'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2',

                name:
                    'Roboto-Regular.ttf',

                family:
                    'RobotoWA'
            }

        ]


        for (const font of fontConfigs) {

            const fontPath =
                join(
                    FONTS_DIR,
                    font.name
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
         * Apple emoji data
         */
        if (!existsSync(APPLE_EMOJI_JSON_LOCAL)) {

            await downloadFile(
                APPLE_EMOJI_JSON_URL,
                APPLE_EMOJI_JSON_LOCAL
            )

        }


        const appleEmojiMap =
            JSON.parse(
                readFileSync(
                    APPLE_EMOJI_JSON_LOCAL,
                    'utf8'
                )
            )


        const emojiCache =
            new Map()


        /*
         * Background
         */
        if (!existsSync(BG_LOCAL)) {

            await downloadFile(
                BG_URL,
                BG_LOCAL
            )

        }


        /*
         * Download foto yang direply
         */
        const ppBuffer =
            await q.download()


        if (!ppBuffer) {
            throw new Error(
                'Foto gagal didownload.'
            )
        }


        const avImg =
            await loadImage(
                ppBuffer
            )


        const bgImg =
            await loadImage(
                BG_LOCAL
            )


        /*
         * Canvas
         */
        const canvas =
            createCanvas(
                bgImg.width,
                bgImg.height
            )


        const ctx =
            canvas.getContext('2d')


        ctx.drawImage(
            bgImg,
            0,
            0,
            canvas.width,
            canvas.height
        )


        /*
         * Posisi foto profil
         */
        const ppX =
            canvas.width / 2


        const ppY =
            728


        const ppRadius =
            220


        /*
         * Foto profil bulat
         */
        ctx.save()

        ctx.beginPath()

        ctx.arc(
            ppX,
            ppY,
            ppRadius,
            0,
            Math.PI * 2
        )

        ctx.closePath()

        ctx.clip()

        ctx.drawImage(
            avImg,
            ppX - ppRadius,
            ppY - ppRadius,
            ppRadius * 2,
            ppRadius * 2
        )

        ctx.restore()


        /*
         * Emoji detector
         */
        const EMOJI_DETECTOR =
            /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u


        function emojiToUnicode(emoji) {

            return [...emoji]
                .map(char =>
                    char
                        .codePointAt(0)
                        .toString(16)
                        .padStart(4, '0')
                )
                .join('-')

        }


        async function getEmojiImage(emoji) {

            if (emojiCache.has(emoji)) {
                return emojiCache.get(emoji)
            }


            const base =
                emojiToUnicode(emoji)


            const variants = [

                base,

                base.replace(
                    /-fe0f/gi,
                    ''
                ),

                `${base.replace(
                    /-fe0f/gi,
                    ''
                )}-fe0f`,

                base.toUpperCase(),

                base
                    .replace(
                        /-fe0f/gi,
                        ''
                    )
                    .toUpperCase(),

                base
                    .replace(
                        /-fe0f/gi,
                        ''
                    )
                    .toUpperCase() +
                    '-FE0F'

            ]


            let b64 = null


            for (const variant of variants) {

                if (appleEmojiMap[variant]) {

                    b64 =
                        appleEmojiMap[variant]

                    break

                }

            }


            if (!b64) {
                return null
            }


            const img =
                await loadImage(
                    Buffer.from(
                        b64,
                        'base64'
                    )
                )


            emojiCache.set(
                emoji,
                img
            )


            return img
        }


        function parseTextAndEmojis(textStr) {

            const tokens = []

            const chars = [
                ...textStr
            ]

            let currentText = ''


            for (
                let i = 0;
                i < chars.length;
                i++
            ) {

                if (
                    EMOJI_DETECTOR.test(
                        chars[i]
                    )
                ) {

                    if (currentText) {

                        tokens.push({
                            type: 'text',
                            value: currentText
                        })

                        currentText = ''

                    }


                    let emojiVal =
                        chars[i]


                    if (
                        chars[i + 1] === '\uFE0F'
                    ) {

                        emojiVal +=
                            chars[i + 1]

                        i++

                    }


                    tokens.push({
                        type: 'emoji',
                        value: emojiVal
                    })

                } else {

                    currentText +=
                        chars[i]

                }

            }


            if (currentText) {

                tokens.push({
                    type: 'text',
                    value: currentText
                })

            }


            return tokens
        }


        function measureTextCustom(
            context,
            tokens,
            fontSize
        ) {

            let totalWidth = 0


            for (const token of tokens) {

                if (
                    token.type === 'emoji'
                ) {

                    totalWidth +=
                        fontSize * 1.05

                } else {

                    totalWidth +=
                        context
                            .measureText(
                                token.value
                            )
                            .width

                }

            }


            return totalWidth
        }


        async function drawTextWithEmojisCenter(
            context,
            textStr,
            yPos,
            fontSize,
            fontString
        ) {

            context.font =
                fontString


            context.textBaseline =
                'top'


            const tokens =
                parseTextAndEmojis(
                    textStr
                )


            const totalWidth =
                measureTextCustom(
                    context,
                    tokens,
                    fontSize
                )


            let currentX =
                (canvas.width / 2) -
                (totalWidth / 2)


            for (const token of tokens) {

                if (
                    token.type === 'emoji'
                ) {

                    const emojiSize =
                        fontSize * 1.05


                    const img =
                        await getEmojiImage(
                            token.value
                        )


                    if (img) {

                        context.drawImage(
                            img,
                            currentX,
                            yPos +
                                (fontSize - emojiSize) / 2,
                            emojiSize,
                            emojiSize
                        )

                    } else {

                        context.fillText(
                            token.value,
                            currentX,
                            yPos
                        )

                    }


                    currentX +=
                        emojiSize

                } else {

                    context.fillText(
                        token.value,
                        currentX,
                        yPos
                    )


                    currentX +=
                        context
                            .measureText(
                                token.value
                            )
                            .width

                }

            }

        }


        /*
         * Nama
         */
        ctx.fillStyle =
            '#FFFFFF'


        await drawTextWithEmojisCenter(
            ctx,
            txtNama,
            75,
            42,
            '700 42px RobotoWA, sans-serif'
        )


        /*
         * Durasi
         */
        ctx.fillStyle =
            '#AEBAC1'


        await drawTextWithEmojisCenter(
            ctx,
            txtDurasi,
            130,
            30,
            '400 30px RobotoWA, sans-serif'
        )


        /*
         * Penanda simulasi
         */
        ctx.save()

        ctx.globalAlpha = 0.75

        ctx.fillStyle =
            '#FF0000'

        ctx.font =
            '700 42px RobotoWA, sans-serif'

        ctx.textAlign =
            'center'

        ctx.textBaseline =
            'middle'

        ctx.fillText(
            'FAKE CALL • SIMULASI',
            canvas.width / 2,
            canvas.height - 60
        )

        ctx.restore()


        /*
         * Output
         */
        const outPath =
            join(
                TMP_DIR,
                `wacall-${Date.now()}.png`
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
                    `: *FAKE CALL • SIMULASI* :\n\n` +
                    `✎ *Nama:* ${txtNama}\n` +
                    `✎ *Durasi:* ${txtDurasi}\n\n` +
                    `⚠️ Hanya untuk demo/hiburan.`
            },

            {
                quoted: m
            }
        )


        /*
         * Bersihkan file temporary
         */
        if (existsSync(outPath)) {

            await unlink(
                outPath
            )

        }

    } catch (error) {

        console.error(
            '[FAKECALL2 ERROR]',
            error
        )


        return m.reply(
            `❌ *Gagal membuat canvas fakecall*\n\n` +
            `${error.message}`
        )

    }

}


export default {
    config,
    handler
}