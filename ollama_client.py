import ollama
from quart import current_app, jsonify
#import aiohttp
import asyncio
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor()

def get_client(settings):
    return ollama.Client(host=settings["ollama_url"], timeout=30)

def get_ollama_response(model, messages):
    client = get_client()
    response = client.chat(
        model=model,
        stream=True,
        messages=messages
    )
    assistant_message = ''.join(chunk['message']['content'] for chunk in response)
    return assistant_message

def pick_next_character_response(model, prompt):
    client = get_client()
    response = client.chat(
        model=model,
        stream=True,
        messages=[prompt]
    )
    next_character = ''.join(chunk['message']['content'] for chunk in response)
    return next_character.strip()

## a function to call OLLAMA generate on a string prompt instead of a list of messages
def get_ollama_response_sync(model, prompt, app_settings):
    client = get_client(app_settings)
    response = client.generate(
        model=model,
        prompt=prompt,
        stream=False
    )
    return response['response']

async def get_ollama_response_single(model, prompt, app_settings):
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(executor, get_ollama_response_sync, model, prompt, app_settings)
    return response