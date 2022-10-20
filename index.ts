import WAWebJS, {Client, LocalAuth, MessageTypes} from 'whatsapp-web.js'
import qrcode from 'qrcode-terminal'
import WebSocket from 'ws'
import {toFile} from 'qrcode'

const client = new Client({authStrategy: new LocalAuth()})
let isClientInitialized = false

require('dotenv').config()

const wsUrl = `ws://localhost:${process.env.WS_PORT ?? 3333}`

let ws = new WebSocket(wsUrl, {})

ws.addEventListener('error', async e => {
  console.log(`connection failed because ${e.message}, will try again in 5s`)
  await delay(5000)

  ws = new WebSocket(wsUrl, {})
})

ws.addEventListener('open', async () => {
  console.log(`connected to ws at ${wsUrl}`)

  await client.initialize()
})

ws.addEventListener('close', async reason => {
  console.log(`disconnected from because ${JSON.stringify(reason)}`)

  if (isClientInitialized) {
    await client.destroy()

    process.exit(1)
  }
})

const sendMessage = async (
  content: WAWebJS.MessageContent,
  chat: WAWebJS.Chat,
  options?: WAWebJS.MessageSendOptions | undefined
): Promise<WAWebJS.Message> => {
  await client.sendPresenceAvailable()
  await delay(randomIn(1000, 2000))

  await chat.sendStateTyping()

  const msg = await chat.sendMessage(content, options)

  await chat.clearState()
  await client.sendPresenceUnavailable()

  return msg
}

type WsMessage = {
  event: string
}

type WsTranscriptData = {
  payload: {
    transcript: string
    chatId: string
    messageId: string
  }
} & WsMessage

ws.addEventListener('message', async ({data, ...e}: any) => {
  let _data

  try {
    _data = JSON.parse(data)
  } catch {
    _data = data
  }

  if (!_data) {
    return
  }

  if (typeof _data === 'object' && _data.event === 'reply_with_transcription') {
    const {payload} = _data as WsTranscriptData

    if (!payload) {
      console.error('no payload received')
      return
    }

    const chat = await client.getChatById(payload.chatId)

    if (!chat) {
      console.error(`could not find chat ${payload.chatId}`)
      return
    }

    await sendMessage(payload.transcript, chat, {
      quotedMessageId: payload.messageId,
    })
  } else {
    console.log(_data)
  }
})

client.on('qr', qr => {
  console.log(`got qr at ${new Date().toISOString()}`)
  qrcode.generate(qr, {small: true})
  toFile('qrcode.png', qr)
})

client.on('ready', () => {
  console.log('client is ready')
  isClientInitialized = true
})

const isAudio = (msg: WAWebJS.Message) =>
  msg.hasMedia &&
  (msg.type === MessageTypes.AUDIO || msg.type === MessageTypes.VOICE)

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const randomIn = (min: number, max: number) => Math.random() * (max - min) + min

client.on('message', async msg => {
  const chat = await msg.getChat()
  if (isAudio(msg)) {
    try {
      const media = await msg.downloadMedia()

      if (media === undefined) {
        throw new Error('got undefined media.')
      }

      const {data, mimetype} = media

      ws.send(
        JSON.stringify({
          event: 'transcript_audio',
          payload: {
            data,
            mimetype,
            messageId: msg.id._serialized,
            chatId: msg.from,
          },
        })
      )

      console.log('sent data to ws')
    } catch (e) {
      console.error(e)

      await sendMessage('failed to process media', chat, {
        quotedMessageId: msg.id._serialized,
      })
      await msg.react('👎')
    }
  } else {
    console.log(`got message with body: ${msg.body}`)
  }
})
