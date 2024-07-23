from quart import json
from utils.character_utils import get_character

CharacterInstruction = """
You are the following character participating in a multi-character conversation:
Character Schema: {CharacterSchema}
"""

def get_system_prompt(char):
    return CharacterInstruction.format(CharacterSchema=json.dumps(char, indent=2))

def get_message_array(character, chat_messages, no_prompt=False):
    if no_prompt:
        return chat_messages
    else:
        _prompt = {"role": "system", "content": get_system_prompt(character), "character": character['name']}
        return [_prompt] + chat_messages

def create_message(message, role, character=None):
    return {"role": role, "content": message, "character": character}
