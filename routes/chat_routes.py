from quart import Blueprint, request, jsonify, Response
from ollama_client import get_ollama_response, get_ollama_response_single, stream_ollama_response_single
from utils.message_utils import create_message, get_message_array, get_system_prompt
from utils.character_utils import get_character, CharacterSchema, load_characters
from quart import current_app
import logging
import asyncio

chat_bp = Blueprint('chat', __name__)


def get_settings():
    settings = current_app.config['SETTINGS']
    return settings

@chat_bp.route('/simple_stream', methods=['GET'])
async def simple_stream():
    async def generate():
        for i in range(5):
            yield f"data: Message {i}\n\n"
            await asyncio.sleep(1)
    
    return Response(generate(), mimetype='text/event-stream')

def build_conversation_prompt(char, conversation, respondents, title="", lore="", setting=""):
    conversation_prompt =  f"""
    Name: {char['name']}
    Age: {char['age']}
    Description: {char['description']}
    Personality: {char['personality']}
    
    Story Title: {title}
    World Lore: {lore}
    
    Story Setting: {setting}
    
    Other NPCs in the Story: {[item for item in respondents if item != char['name']]}
        
    The Story So Far:
    """ 
    
    for message in conversation:
        conversation_prompt += f"{message['character']}:\n {message['content']}\n\n"
    
    if(char['instructions'].strip() != ""):
        conversation_prompt += f"[SPECIAL CHARACTER INSTRUCTION: {char['instructions']}]\n\n"
        
    
    
    conversation_prompt += f"\n\n (IMPORTANT: Respond with only {char['name']}'s contribution.)\n\n{char['name']}:\n" #TODO: Add a setting for max response length
    return conversation_prompt

# @chat_bp.route('/get_character_message', methods=['POST'])
# async def get_character_message():
#     data = await request.json
    
#     respondents = data.get("respondents", [])
#     conversation = data.get("conversation", [])
#     title = data.get("title", "")
#     lore = data.get("lore", "")
#     setting = data.get("setting", "")
    
#     app_settings = current_app.config['SETTINGS']
    
#     if len(respondents) == 0:
#         return jsonify({"status": "error", "message": "No respondents provided"}), 400
    
#     if len(respondents) == 1:
#         next_character = respondents[0]['name']
#     else:
#         settings = get_settings()
#         attempts = settings['maximum_turn_taking_attempts']
#         next_character = await AITurnPickNextCharacter(respondents, conversation, attempts)
    
#     char = get_character(respondents, next_character)
    
#     if not char:
#         return jsonify({"status": "error", "message": "Character not found"}), 400
    
#     conversation_prompt = build_conversation_prompt(char, conversation, respondents, title, lore, setting)
    
#     async def generate():
#         async for chunk in stream_ollama_response_single(char['model'], conversation_prompt, app_settings):
#             yield f"data: {chunk}\n\n"
    
#     return Response(generate(), mimetype='text/event-stream')

@chat_bp.route('/get_character_message', methods=['POST'])
async def get_character_message():
    data = await request.json
    
    #print(f"Got request for character message: {data}")
    
    respondents = data.get("respondents", [])
    #print(f"Respondents: {respondents}")
    conversation = data.get("conversation", [])
    title = data.get("title", "")
    lore = data.get("lore", "")
    setting = data.get("setting", "")
    
    app_settings = current_app.config['SETTINGS']
    
    if len(respondents) == 0:
        print("No respondents provided")
        return jsonify({"status": "error", "message": "No respondents provided"}), 400
    
    if len(respondents) == 1:
        next_character = respondents[0]['name']
    else:
        settings = get_settings()
        attempts = settings['maximum_turn_taking_attempts']
        next_character = await AITurnPickNextCharacter(respondents, conversation, attempts)
    
    
    char = get_character(respondents, next_character)
    
    if not char:
        return jsonify({"status": "error", "message": "Character not found"}), 400
    
    
    conversation_prompt = build_conversation_prompt(char, conversation, respondents, title, lore, setting)
    
    assistant_message = await get_ollama_response_single(char['model'], conversation_prompt, app_settings)
    assistant_message = strip_name_from_message(assistant_message, respondents)
    
    newMessage = create_message(assistant_message, 'assistant', char['name'])
    return jsonify({"assistant_message": newMessage})

async def AITurnPickNextCharacter(respondents, chat_messages=[], turn=3, prompt=None):
    
    app_settings = current_app.config['SETTINGS']
    
    characters = [item['name'] for item in respondents]
    turn -= 1
    
    if turn < 0:
        return getLastAssistantCharacter(chat_messages)

    names = ", ".join(characters)
    
    conversation_prompt = "Read the story so far and decide who should speak next.\n\nThe Story So Far:\n"
    if prompt:
        conversation_prompt = prompt
    else:
        for message in chat_messages:
            #print(f"Message: {message}")
            conversation_prompt += f"{message['character']}:\n {message['content']}\n\n"
        
        conversation_prompt += f"Your response will contain only one name from this list: {names}\n: "
    
    
    
    settings = get_settings()
    charmodel = settings['turn_taking_model']
    #charmodel = "lumo-actor:latest"
    
    proposed_next = await get_ollama_response_single(charmodel, conversation_prompt, app_settings)
    
    proposed_next = proposed_next.strip()
    
    char = get_character(respondents, proposed_next)
    
    if char:
        print(f"AI returned proper name: {proposed_next} in turn {turn}")
        return proposed_next
    else:
        embededName = NameInMessage(proposed_next, respondents)
        if embededName:
            print(f"Name in message: {embededName} in turn {turn}")
            return embededName
        else:
            return await AITurnPickNextCharacter(respondents, chat_messages, turn, conversation_prompt)

def NameInMessage(message, respondents):
    names = [item['name'] for item in respondents]
    for name in names:
        if message.startswith(f"{name}:"):
            return name
    return None

### a function that strips any "name:" from the beginning of a string
def strip_name_from_message(message, respondents):
    names = [item['name'] for item in respondents]
    for name in names:
        if message.startswith(f"{name}:"):
            return message.split(":", 1)[1].strip()
    return message
    


def getLastAssistantCharacter(chat_messages):
    for message in reversed(chat_messages):
        if message.get('role') == 'assistant':
            return message.get('character')
    return None  # Return None if no assistant message is found


    
