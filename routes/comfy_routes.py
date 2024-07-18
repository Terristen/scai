from flask import Blueprint, request, jsonify, current_app
from utils.app_utils import load_settings, save_settings
from ollama_client import get_ollama_response_single
from werkzeug.utils import secure_filename

import json
import re

import websocket #NOTE: websocket-client (https://github.com/websocket-client/websocket-client)
import uuid
import urllib.request
import urllib.parse
import random
from requests_toolbelt import MultipartEncoder

from os import path
from datetime import datetime

comfy_bp = Blueprint('comfy', __name__)

def get_settings():
    settings = current_app.config['SETTINGS']
    return settings

def sanitize_json_string(json_string):
        # Use regex to find all string values in the JSON and apply the replacement
        sanitized = re.sub(r'(?<!\\)"(.*?)(?<!\\)"', lambda m: m.group(0).replace(m.group(1), m.group(1).replace('"', '\"')), json_string)
        return sanitized

def get_comfy_prompt_data(character, chat_messages=[],prompt=None):
    settings = get_settings()
    analysis_model = settings['analyst_model']
    
    conversation_prompt = ""
    if prompt:
        conversation_prompt = prompt
    else:
        conversation_prompt = f"SYSTEM: Read the following conversation carefully from the perspective of {character['name']} so that you can respond to the prompt that follows:\n\n"
        for message in chat_messages:
            conversation_prompt += f"{message['character']}:\n{message['content']}\n\n"
        
        conversation_prompt += f"""
        The character {character['name']} is described as follows:
        Age:"{character['age']}"
        Description:"{character['description']}"
        \n\n
        PROMPT: Respond with the following json object populated with the appropriate values for the character, '{character['name']}':
        {{
        "gender"="(male or female)",
        "age"="(# years old)", 
        "ethnicity"="(any description of ethnicity appropriate for the character)",
        "description"="(important physical characteristics of the character such as hair color, eye color, height, etc.)",
        "attitude"="(the mood or attitude of the character in the conversation at this point)", 
        "pose"="(position or action the character is taking in the conversation at this point)", 
        "attire"="(description of clothing the character is wearing in the conversation at this point; nude if no clothing is present)",
        "environment"="(the setting of the conversation that the character is in at this point)", 
        "lighting"="(a description of the lighting in the scene where the character is at this point in the conversation)"
        }}
        """
        
        response = get_ollama_response_single(analysis_model, conversation_prompt)
        
        #sometimes the AI adds extra to the response, so we need to strip it out. Use Regex to find the json object
        pattern = r'\{.*?\}'
        match = re.search(pattern, response, re.DOTALL)
        if match:
            # Extract the JSON string
            response = match.group(0)
        else:
            print("no JSON object found")
            
        response = sanitize_json_string(response)
        
        print(response)
        return response
    


#route to generate an image for a given character based on a fixed set of parameters only requires the character data object and the story array of messages
@comfy_bp.route('/generate', methods=['POST'])
def generate():
    settings = get_settings()
    server_address = settings.get("comfy_ip")
    image_workflow = settings.get("photo_workflow")
    cache_directory = settings.get("cache_directory")
    cast_photos_directory = settings.get("cast_photos_directory")
    
    character_data = request.json.get("character", None)
    if(character_data is None):
        return jsonify({"status": "error", "message": "No character data provided"}), 400
    
    story_data = request.json.get("story", []) #for later use
    prompt_data = json.loads(get_comfy_prompt_data(character_data,story_data, None))
    #print(prompt_data)
    
    
    character = CharacterData(
        character_data["name"],
        path.join(cast_photos_directory, character_data["icon"]),
        "8k ultra-detailed high contrast close-up portrait",
        prompt_data["lighting"],
        prompt_data["gender"],
        f"{prompt_data['age']} years old",
        prompt_data["ethnicity"],
        prompt_data["description"],
        prompt_data["attitude"],
        prompt_data["pose"],
        prompt_data["environment"],
        prompt_data["attire"])
    
    if(character_data.get("sfw", True) == False):
        character.sfw = False
    
    #print(character.portrait)
    files = get_character_photo(character, image_workflow, server_address, cache_directory)
    return jsonify(files)

class CharacterData:
    def __init__(self, name, portrait, style, lighting, gender, age, ethnicity, description, attitude, pose, environment, attire, sfw=True):
        self.name = name
        self.portrait = portrait
        self.style = style
        self.lighting = lighting
        self.gender = gender
        self.age = age
        self.ethnicity = ethnicity
        self.description = description
        self.attitude = attitude
        self.pose = pose
        self.environment = environment
        self.attire = attire
        self.sfw = sfw

server_address = "127.0.0.1:8188"
client_id = str(uuid.uuid4())

def queue_prompt(prompt):
    p = {"prompt": prompt, "client_id": client_id}
    data = json.dumps(p).encode('utf-8')
    req =  urllib.request.Request("http://{}/prompt".format(server_address), data=data)
    return json.loads(urllib.request.urlopen(req).read())

def get_image(filename, subfolder, folder_type):
    data = {"filename": filename, "subfolder": subfolder, "type": folder_type}
    url_values = urllib.parse.urlencode(data)
    with urllib.request.urlopen("http://{}/view?{}".format(server_address, url_values)) as response:
        return response.read()

def get_history(prompt_id):
    with urllib.request.urlopen("http://{}/history/{}".format(server_address, prompt_id)) as response:
        return json.loads(response.read())

def get_images(ws, prompt):
    prompt_id = queue_prompt(prompt)['prompt_id']
    output_images = {}
    while True:
        out = ws.recv()
        if isinstance(out, str):
            message = json.loads(out)
            if message['type'] == 'executing':
                data = message['data']
                if data['node'] is None and data['prompt_id'] == prompt_id:
                    break #Execution is done
        else:
            continue #previews are binary data

    history = get_history(prompt_id)[prompt_id]
    for o in history['outputs']:
        for node_id in history['outputs']:
            node_output = history['outputs'][node_id]
            if 'images' in node_output:
                images_output = []
                for image in node_output['images']:
                    image_data = get_image(image['filename'], image['subfolder'], image['type'])
                    images_output.append(image_data)
            output_images[node_id] = images_output

    return output_images

def upload_image(input_path, name, server_address, image_type="input", overwrite=False):
    
  print(f"Path exists? {path.exists(input_path)}")
  with open(input_path, 'rb') as file:
    multipart_data = MultipartEncoder(
      fields= {
        'image': (name, file, 'image/png'),
        'type': image_type,
        'overwrite': str(overwrite).lower()
      }
    )

    data = multipart_data
    headers = { 'Content-Type': multipart_data.content_type }
    request = urllib.request.Request("http://{}/upload/image".format(server_address), data=data, headers=headers)
    with urllib.request.urlopen(request) as response:
      return response.read()

def save_images(images, folder, filename_root):
    image_names = []
    imgnum = 0
    now = datetime.now()
    timestamp_str = now.strftime("%Y%m%d%H%M%S")
    for node_id in images:
        for i, image_data in enumerate(images[node_id]):
            imgnum += 1
            with open("{}/{}_{}_{}.png".format(folder, filename_root, timestamp_str,imgnum), 'wb') as f:
                f.write(image_data)
                image_names.append(path.basename(f.name))
    return image_names


def get_character_photo(character_data, workflow, server_address, output_folder, seed=None):
    then = datetime.now()
    prompt_text = open(workflow).read()
    prompt = json.loads(prompt_text)
    comfy_filename = path.basename(character_data.portrait)
    upload_image(character_data.portrait, comfy_filename, server_address, "input", True)
    
    ## specialized to the workflow I've created TODO: generalize this to all other workflows with different node structures
    prompt["59"]["inputs"]["prompt"] = f"""
    style={character_data.style},
    lighting={character_data.lighting},
    gender={character_data.gender},
    age={character_data.age}, 
    ethnicity={character_data.ethnicity},
    description={character_data.description},
    attitude={character_data.attitude}, 
    pose={character_data.pose}, 
    environment={character_data.environment}, 
    attire={character_data.attire}
    """
    
    if character_data.sfw:
        prompt["59"]["inputs"]["prompt"] += ", details=(SFW:1.5)"
        prompt["57"]["inputs"]["prompt"] += ", details=(Nude:1.5), (NSFW:1.5), sex, nudity"
        
    
    #set the seed for our KSampler node
    prompt["6"]["inputs"]["seed"] = random.randint(0, 999999999) if seed is None else seed
    
    prompt["16"]["inputs"]["image"] = comfy_filename
    
    ws = websocket.WebSocket()
    ws.connect("ws://{}/ws?clientId={}".format(server_address, client_id))
    images = get_images(ws, prompt)
    now = datetime.now()
    timestamp_str = now.strftime("%Y%m%d%H%M%S")
    files = save_images(images, output_folder, character_data.name)
    return files


