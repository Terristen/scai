from flask import current_app
import json
import os
import logging


CharacterSchema = {
    "name": "string",
    "age": "string",
    "description": "string",
    "personality": "string",
    "icon": "string",
    "model": "string"
}

def get_settings():
    settings = current_app.config['SETTINGS']
    return settings

#Ensure you use the filename.extension for the castname parameter to allow for YAML in the future
def load_characters(castname="default.json", create=True):
    settings = current_app.config['SETTINGS']
    
    if not castname:
        castname = settings.get("default_cast", "default.json")

    cast_file = castname
    cast_folder = settings.get("cast_of_characters_directory", "user_content/cast/")
    
    if not os.path.exists(cast_folder):
        os.makedirs(cast_folder)
    
    cast_path = os.path.join(cast_folder, cast_file)
    
    if create and not os.path.exists(cast_path):
        with open(cast_path, 'w') as file:
            json.dump([{
                "age": "0",
                "description": "AI Chat Assistant",
                "name": "Assistant",
                "personality": "Friendly and helpful. Always ready to assist the user in any way you can.",
                "icon": "characters/default.jpg",
                "model": settings.get("default_actor_model", "stheno-actor:latest"),
                "instructions": "Answer in short sentences. Use simple words. Be polite and respectful."
            }], file)

    try:
        with open(cast_path, 'r') as file:
            current_app.config['loaded_cast'] = cast_file
            result = json.load(file)
            #print(f"fileresults: {result}")
            return result
    except FileNotFoundError:
        current_app.config['loaded_cast'] = None
        logging.error(f"Could not find the file {cast_path}, returned empty array instead.")
        return []


def save_characters(characters, castname=None):
    if not castname:
        castname = current_app.config.get('loaded_cast')
    
    if not castname:
        logging.error("No cast file loaded, cannot save characters.")
        return

    settings = current_app.config['SETTINGS']
    cast_file = castname
    cast_folder = settings.get("cast_of_characters_directory", "user_content/cast/")
    cast_path = os.path.join(cast_folder, cast_file)  # Improved path construction

    with open(cast_path, 'w') as file:
        json.dump(characters, file)


def get_character(characters, character_name=None, default="Assistant"):
    if not character_name:
        character_name = default

    logging.info(f"Searching for character: {character_name}")
    character_name = character_name.lower()
    for character in characters:
        if character["name"].lower() == character_name:
            return character
    return None


##function to get the list of cast json files in the cast_of_characters_directory
def get_cast_list():
    settings = get_settings()
    cast_folder = settings.get("cast_of_characters_directory", "user_content/cast/")
    cast_files = os.listdir(cast_folder)
    return cast_files