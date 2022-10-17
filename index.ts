import WAWebJS, {Client, LocalAuth, MessageTypes} from 'whatsapp-web.js'
import qrcode from 'qrcode-terminal'
import WebSocket from 'ws'

const client = new Client({authStrategy: new LocalAuth()})

require('dotenv').config()

const wsUrl = `ws://localhost:${process.env.WS_PORT ?? 3333}`

const ws = new WebSocket(wsUrl, {})

ws.addEventListener('error', e => {
  console.log(`connection failed because ${e.message}`)
})

ws.addEventListener('open', () => {
  console.log(`connected to ws at ${wsUrl}`)
  ws.send('ping')
})

ws.addEventListener('close', ({reason}) => {
  console.log(`disconnected from because ${reason}`)
})

type Payload = {
  data: string
  mimetype?: string
  chatId: string
  messageId: string
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

  console.log({_data})

  if (
    typeof _data === 'object' &&
    _data?.event === 'reply_with_transcription'
  ) {
    const {payload} = _data as WsTranscriptData

    const chat = await client.getChatById(payload.chatId)

    await delay(randomIn(125, 500))
    await chat.sendStateTyping()

    const message = await chat.sendMessage(payload.transcript, {
      quotedMessageId: payload.messageId,
    })
  } else {
    console.log(_data)
  }
})

client.on('qr', qr => {
  console.log(`got qr at ${new Date().toISOString()}`)
  qrcode.generate(qr, {small: true})
})

client.on('ready', () => {
  console.log('Client is ready!')
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
        throw new Error('Got undefined media.')
      }

      const {data, mimetype} = media

      ws.send(
        JSON.stringify({
          event: 'transcript_audio',
          payload: {
            data,
            mimetype,
            messageId: msg.id._serialized,
            chatId: chat.id._serialized,
          },
        })
      )
    } catch (e) {
      console.error(e)

      await delay(randomIn(125, 500))
      await chat.sendStateTyping()

      await msg.reply(`Error while downloading media\n${e}`)
    }
  } else {
    console.log(`got message with body: ${msg.body}`)
  }
})

client.initialize()
