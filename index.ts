import {Client, LocalAuth} from 'whatsapp-web.js'
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

ws.addEventListener('message', ({data, ...e}) => {
  console.log(data)
})

client.on('qr', qr => {
  console.log(`got qr at ${new Date().toISOString()}`)
  qrcode.generate(qr, {small: true})
})

client.on('ready', () => {
  console.log('Client is ready!')
})

client.on('message', msg => {
  console.log(msg)
})

// client.initialize()
