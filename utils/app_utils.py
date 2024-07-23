import json
import logging
from quart import current_app

is_loaded = False


SETTINGS = {
    "ollama_url": "http://127.0.0.1:11434",
    "turn_taking_model": "lumo-turn-taking:latest",
    "default_actor_model": "lumo-actor:latest",
    "analyst_model": "lumo-actor:latest",
    "maximum_turn_taking_attempts": 4,
    "cast_of_characters_directory": "user_content/cast/",
    "default_cast": "default.json",
    "cast_photos_directory": "user_content/cast_photos/",
    "username": "User",
    "comfy_ip": "127.0.0.1:8188",
    "photo_workflow": "user_content/comfy_workflow/advanced_photo_workflow.json",
    "cache_directory": "user_content/cache/"

}

def load_settings():
    if is_loaded:
        return SETTINGS
    else:
        try:
            with open('user_content/settings.json', 'r') as file:
                return json.load(file)
        except FileNotFoundError:
            logging.error("user_content/settings.json file not found. Using default settings.")
            with open('user_content/settings.json', 'w') as file:
                json.dump(SETTINGS, file, indent=4)
                
            return SETTINGS

## save settings to file
def save_settings():
    SETTINGS = current_app.config['SETTINGS']
    
    with open('user_content/settings.json', 'w') as file:
        json.dump(SETTINGS, file, indent=4)