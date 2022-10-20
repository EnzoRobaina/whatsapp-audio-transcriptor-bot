import os
from time import time
from dotenv import load_dotenv
import asyncio
import websockets
import json
import whisper
import base64
import mimetypes

load_dotenv()

WS_PORT = os.getenv("WS_PORT", 3333)


def transcribe(audio_as_b64: str, mimetype: str):
    model = whisper.load_model("base")

    bytez = base64.b64decode(audio_as_b64)

    filename = "_audio_" + str(int(time())) + (mimetypes.guess_extension(mimetype.split(";")[0]) or ".mp3")

    filename = os.path.join("temp", filename)

    with open(filename, "wb+") as f:
        f.write(bytez)

    audio = whisper.load_audio(filename)

    audio = whisper.pad_or_trim(audio)

    mel = whisper.log_mel_spectrogram(audio).to(model.device)

    _, probs = model.detect_language(mel)
    lang: str = max(probs, key=probs.get)

    options = whisper.DecodingOptions(fp16=False, language=lang)
    result = whisper.decode(model, mel, options)

    os.remove(filename)

    return f"Detected language: {lang}\nTranscription: {result.text}"


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
            data = payload["data"]
            mimetype = payload["mimetype"]

            if event == "transcript_audio":
                try:
                    transcript = transcribe(data, mimetype)

                    await websocket.send(
                        json.dumps(
                            {
                                "event": "reply_with_transcription",
                                "payload": {
                                    "transcript": transcript,
                                    "chatId": chat_id,
                                    "messageId": message_id,
                                },
                            }
                        )
                    )
                except Exception as e:
                    print(e)
                    await websocket.send(
                        json.dumps(
                            {
                                "event": "reply_with_error",
                                "payload": {
                                    "error": str(e),
                                    "chatId": chat_id,
                                    "messageId": message_id,
                                },
                            }
                        )
                    )


async def main():
    async with websockets.serve(listener, "localhost", WS_PORT):
        print(f"running ws server on localhost:{WS_PORT}")
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
