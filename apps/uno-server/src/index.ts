import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'

const app = express()
app.use(cors())
const httpServer = createServer(app)
const PORT = process.env.PORT || 3002

httpServer.listen(PORT, () => {
  console.log(`[Server] UNO game server running on port ${PORT}`)
})
