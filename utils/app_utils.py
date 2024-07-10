import json
import logging
from flask import current_app

is_loaded = False

SETTINGS = {
    "ollama_url": "http://127.0.0.1:11434"
}

def load_settings():
    if is_loaded:
        return SETTINGS
    else:
        try:
            with open('settings.json', 'r') as file:
                return json.load(file)
        except FileNotFoundError:
            logging.error("settings.json file not found. Using default settings.")
            return SETTINGS

## save settings to file
def save_settings():
    SETTINGS = current_app.config['SETTINGS']
    
    with open('settings.json', 'w') as file:
        json.dump(SETTINGS, file, indent=4)