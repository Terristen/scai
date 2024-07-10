import ollama
from flask import current_app, jsonify

def get_client():
    settings = current_app.config['SETTINGS']
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
def get_ollama_response_single(model, prompt):
    client = get_client()
    response = client.generate(
        model=model,
        prompt=prompt,
        stream=False
    )
    return response['response']