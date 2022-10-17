import os
from dotenv import load_dotenv
import asyncio
import websockets
import json

load_dotenv()

WS_PORT = os.getenv("WS_PORT", 3333)


async def listener(websocket):
    async for message in websocket:
        _message = None

        try:
            _message = json.loads(message)
        except Exception:
            _message = message

        if isinstance(_message, str):
            print(_message)
        else:
            event = _message["event"]
            payload = _message["payload"]
            chat_id = payload["chatId"]
            message_id = payload["messageId"]

            if event == "transcript_audio":
                await websocket.send(
                    json.dumps(
                        {
                            "event": "reply_with_transcription",
                            "payload": {"transcript": "hello", "chatId": chat_id, "messageId": message_id},
                        }
                    )
                )


async def main():
    async with websockets.serve(listener, "localhost", WS_PORT):
        print(f"running ws server on localhost:{WS_PORT}")
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
