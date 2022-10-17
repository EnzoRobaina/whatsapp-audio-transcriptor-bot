import os
from dotenv import load_dotenv
import asyncio
import websockets

load_dotenv()

WS_PORT = os.getenv("WS_PORT", 3333)


async def listener(websocket):
    async for message in websocket:
        print(message)
        await websocket.send(f"ack {message}")


async def main():
    async with websockets.serve(listener, "localhost", WS_PORT):
        print(f"running ws server on localhost:{WS_PORT}")
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
