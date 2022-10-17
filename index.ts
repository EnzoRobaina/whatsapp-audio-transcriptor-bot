import {Client, LocalAuth} from 'whatsapp-web.js'
import qrcode from 'qrcode-terminal'

const client = new Client({authStrategy: new LocalAuth()})

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

client.initialize()
