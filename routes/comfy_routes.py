from quart import Quart, Blueprint, request, jsonify, current_app, session
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
import aiohttp
import aiofiles
import asyncio
import websockets
import base64

from concurrent.futures import ThreadPoolExecutor
from aiohttp import MultipartWriter
from aiohttp import FormData
import importlib.util
import secrets

comfy_bp = Blueprint('comfy', __name__)

comfy_client_id = "ee9cc135-d22e-4c89-8b82-93e1f2c7dc62"
comfy_ws = None

def get_settings():
    settings = current_app.config['SETTINGS']
    return settings

# Helper function to generate a unique client ID
def generate_client_id():
    global comfy_client_id
    return comfy_client_id
    #return str(uuid.uuid4())

@comfy_bp.before_app_request
async def ensure_client_id():
    if 'client_id' not in session:
        session['client_id'] = generate_client_id()


def sanitize_json_string(json_string):
    lines = json_string.split('\n')
    sanitized_lines = []

    for line in lines:
        # Match lines with key-value pairs
        match = re.match(r'(\s*"\w+":\s*")(.*?)(?<!\\)(",?)$', line)
        if match:
            prefix = match.group(1)  # The key and the leading part of the value
            value = match.group(2)   # The actual value to be sanitized
            suffix = match.group(3)  # The trailing part after the value

            # Escape double quotes within the value
            
            escaped_value = value.replace('"', '', -1)
            
            sanitized_line = f'{prefix}{escaped_value}{suffix}'
            sanitized_lines.append(sanitized_line)
        else:
            # No key-value pair found, just add the line as is
            sanitized_lines.append(line)

    result = '\n'.join(sanitized_lines).strip()
    if(result[-1] != '}'):
        result += "}"
    
    return result
  
async def get_comfy_prompt_data(character, chat_messages=[],prompt=None):
    settings = get_settings()
    analysis_model = settings['analyst_model']
    analysis_model = "lumo-actor:latest"
    
    conversation_prompt = ""
    if prompt:
        conversation_prompt = prompt
    else:
        conversation_prompt = f"""
        SYSTEM: You are an AI performing a precise function to read a story and return a correctly-formed JSON object that describes the character and the scene as it appears in the latest part of the story.
        Story:
        """
        for message in chat_messages:
            conversation_prompt += f"{message['content']}\n\n"
        
        conversation_prompt += f"""
        Your answer should describe the character: 
        Name: {character['name']}
        Age: {character['age']}
        \n\n
        RESPONSE SCHEMA:
        Use the following JSON object to describe the character and the scene as it appears in the latest part of the story. Use short descriptive phrases for each field. Do not include names or other information that is not visual in nature. Avoid using any punctuation or special characters in the descriptions.
        {{
        "gender"="(male or female)",
        "age"="(# years old)", 
        "ethnicity"="(any description of ethnicity appropriate for the character)",
        "pose"="(position or action the character is taking in the conversation at this point)", 
        "attire"="(description of clothing the character is wearing in the conversation at this point; nude if no clothing is present)",
        "expression"="(the facial expression of the character in the conversation at this point)",
        "composition"="(the overall composition of the image to include setting, quality, and style)"
        }}
        """
        
        #print("Prompt: \n" + conversation_prompt)
        app_settings = current_app.config['SETTINGS']
        
        response = await get_ollama_response_single(analysis_model, conversation_prompt, app_settings)
        
        #sometimes the AI adds extra to the response, so we need to strip it out. Use Regex to find the json object
        pattern = r'\{.*?\}'
        match = re.search(pattern, response, re.DOTALL)
        if match:
            # Extract the JSON string
            response = match.group(0)
        else:
            print("no JSON object found")
        
        #print("Response: ")
        #print(response)
        #print("Sanitized:")
        #response = sanitize_json_string(response)
        print(f"Image Prompt Generated: {character['name']}")
        #print(response)
        
        return response
    
def save_base64_image(base64_string, cache_directory):
    # Decode the base64 string
    header, encoded = base64_string.split(",", 1)
    image_data = base64.b64decode(encoded)

    # Generate a unique filename (you can use a timestamp, UUID, etc.)
    filename = f"portrait_{secrets.token_hex(8)}.png"  # Or .jpg based on your use case
    file_path = os.path.join(cache_directory, filename)
    
    # Save the image file
    with open(file_path, "wb") as f:
        f.write(image_data)
    
    return file_path

#route to generate an image for a given character based on a fixed set of parameters only requires the character data object and the story array of messages
@comfy_bp.route('/generate', methods=['POST'])
async def generate():
    settings = get_settings()
    server_address = settings.get("comfy_ip")
    image_workflow = "user_content/workflows/quick_image.py"
    cache_directory = settings.get("cache_directory")
    default_photo_width = settings.get("default_photo_width", 768)
    default_photo_height = settings.get("default_photo_height", 1024)
    
    data = await request.json
    files = await request.files
    
    # go ask for a prompt
    character_data = data.get("character", None)
    if(character_data is None):
        return jsonify({"status": "error", "message": "No character data provided"}), 400
    
    story_data = data.get("story", []) #for later use
    
    prompt = await get_comfy_prompt_data(character_data,story_data, None)
    
    
    #clean the prompt in case it is not a valid JSON object
    try:
        prompt_data = json.loads(prompt)
    except Exception as e:
        prompt = sanitize_json_string(prompt)
        try:
            prompt_data = json.loads(prompt)
        except Exception as e:            
            print("Error: " + prompt)
            return [], 400
    #print(prompt_data)
    
    
    
    args = {}
    
    if "portrait" in data and data["portrait"]:
        face_filename = save_base64_image(data["portrait"], cache_directory)
        args["portrait"] = face_filename
    else:
        args["portrait"] = None
    
    
    #loop through prompt data and concat keyvalue pairs to the prompt string with commas
    
    args["prompt"] = ""
    for key in prompt_data:
        args["prompt"] += f'{key}={prompt_data[key]},'
    
    
    args["sfw"] = data.get("sfw", False)
    args["age_adjust"] = data.get("age_adjust", 0)
    
    args["width"] = data.get("portrait_width", default_photo_width)
    args["height"] = data.get("portrait_height", default_photo_height)
    
    args["cfg"] = data.get("cfg", 3)
    args["steps"] = data.get("steps", 20)
    args["seed"] = data.get("seed")
    
    #print(args)
    
    images_pkg = await get_photos(image_workflow, server_address, cache_directory, args)
    
    # images_pkg = {
    #     "images": [images_encoded],  # List of base64-encoded images
    #     "seed": seed used to generate the images
    # }
    
    return jsonify(images_pkg)
    
async def get_photos(workflow, server_address, output_folder, args):
    then = datetime.now()
    #print(args)
    
    print(f"Loading workflow module: {path.basename(workflow)}")
    spec = importlib.util.spec_from_file_location("workflow_module", workflow)
    workflow_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(workflow_module)
    
    print(f"Workflow module loaded in {datetime.now() - then}")
    
    comfy_filename = None
    if(args["portrait"] is not None):
        comfy_filename = path.basename(args["portrait"])
        await upload_image(args["portrait"], comfy_filename, server_address, "input", True)
        
        try:
            os.remove(args["portrait"])
            print(f"Deleted {args['portrait']} from the server.")
        except OSError as e:
            print(f"Error: {args['portrait']} : {e.strerror}")
            
    
    w = args.get("width", 768)
    h = args.get("height", 1024)
    
    sfw = args.get("sfw", False)
    prompt = args.get("prompt", "a person")
    age_adjust = args.get("age_adjust", 0)
    cfg = args.get("cfg", 3)
    steps = args.get("steps", 20)
    seed = args.get("seed")
    
    #print("age_adjust: ", age_adjust)    
    prompt, calculatedSeed = workflow_module.GetWorkflow(comfy_filename, True, width=w, height=h, sfw=sfw, prompt=prompt, age_adjust=age_adjust, cfg=cfg, steps=steps, seed=seed)
    
    
    print(f"Connecting to Comfy server at {server_address} and client_id={session.get('client_id')}")
    ws_url = f"ws://{server_address}/ws?clientId={session.get('client_id')}"
    
    async with websockets.connect(ws_url) as comfy_ws:
        images = await get_images(comfy_ws, prompt, server_address, session.get('client_id'))
    
    now = datetime.now()
    timestamp_str = now.strftime("%Y%m%d%H%M%S")
    
    print(f"Images received in {now - then}s")
    
    print(f"Saving {len(images)} images to {output_folder}")
    images = await encode_images(images)
    #files = await save_images(images, output_folder, "portrait_" + then.strftime("%Y%m%d%H%M%S"))
    
    return {"seed": calculatedSeed, "images": images}


#client_id = str(uuid.uuid4())
async def queue_prompt(prompt, server_address, client_id):
    p = {"prompt": prompt, "client_id": client_id}
    async with aiohttp.ClientSession() as session:
        async with session.post(f"http://{server_address}/prompt", json=p) as resp:
            return await resp.json()
        
# def queue_prompt(prompt):
#     settings = get_settings()
#     server_address = settings.get("comfy_ip")
#     p = {"prompt": prompt, "client_id": session.get('client_id')}
#     data = json.dumps(p).encode('utf-8')
#     req =  urllib.request.Request("http://{}/prompt".format(server_address), data=data)
#     return json.loads(urllib.request.urlopen(req).read())

async def get_image(filename, subfolder, folder_type, server_address):
    data = {"filename": filename, "subfolder": subfolder, "type": folder_type}
    url_values = urllib.parse.urlencode(data)
    async with aiohttp.ClientSession() as session:
        async with session.get(f"http://{server_address}/view?{url_values}") as resp:
            return await resp.read()

# def get_image(filename, subfolder, folder_type):
#     settings = get_settings()
#     server_address = settings.get("comfy_ip")
#     data = {"filename": filename, "subfolder": subfolder, "type": folder_type}
#     url_values = urllib.parse.urlencode(data)
#     with urllib.request.urlopen("http://{}/view?{}".format(server_address, url_values)) as response:
#         return response.read()

async def get_history(prompt_id, server_address):
    async with aiohttp.ClientSession() as session:
        async with session.get(f"http://{server_address}/history/{prompt_id}") as resp:
            return await resp.json()

# def get_history(prompt_id):
#     settings = get_settings()
#     server_address = settings.get("comfy_ip")
#     with urllib.request.urlopen("http://{}/history/{}".format(server_address, prompt_id)) as response:
#         return json.loads(response.read())

async def ping_ws(ws):
    while True:
        try:
            await ws.send(json.dumps({"type": "ping"}))
            await asyncio.sleep(2)  # Ping every 30 seconds
        except Exception as e:
            print(f"Ping failed: {e}")
            break

async def get_images(ws, prompt, server_address, client_id):
    prompt_id = (await queue_prompt(prompt, server_address, client_id))['prompt_id']
    output_images = {}
    current_node = ""

    while True:
        try:
            out = await asyncio.wait_for(ws.recv(), timeout=60)  # Timeout after 30 seconds
            #print(json.dumps(out))
        except asyncio.TimeoutError:
            print("Timeout: No message received from WebSocket within 60 seconds.")
            break

        if isinstance(out, str):
            message = json.loads(out)
            if message['type'] == 'executing':
                data = message['data']
                if data['prompt_id'] == prompt_id:
                    if data['node'] is None:
                        break  # Execution is done
                    else:
                        current_node = data['node']
        else:
            if current_node == 'save_image_websocket_node':
                images_output = output_images.get(current_node, [])
                images_output.append(out[8:])
                output_images[current_node] = images_output

    history = (await get_history(prompt_id, server_address))[prompt_id]
    for o in history['outputs']:
        for node_id in history['outputs']:
            node_output = history['outputs'][node_id]
            if 'images' in node_output:
                images_output = []
                for image in node_output['images']:
                    image_data = await get_image(image['filename'], image['subfolder'], image['type'], server_address)
                    images_output.append(image_data)
                output_images[node_id] = images_output

    return output_images

# async def get_images(ws, prompt):
#     prompt_id = queue_prompt(prompt)['prompt_id']
#     output_images = {}
#     #print("getting images")
#     while True:
#         out = ws.recv()
#         #print("received")
#         if isinstance(out, str):
#             message = json.loads(out)
#             if message['type'] == 'executing':
#                 data = message['data']
#                 if data['node'] is None and data['prompt_id'] == prompt_id:
#                     break #Execution is done
#         else:
#             continue #previews are binary data

#     history = get_history(prompt_id)[prompt_id]
#     for o in history['outputs']:
#         for node_id in history['outputs']:
#             node_output = history['outputs'][node_id]
#             if 'images' in node_output:
#                 images_output = []
#                 for image in node_output['images']:
#                     image_data = get_image(image['filename'], image['subfolder'], image['type'])
#                     images_output.append(image_data)
#             output_images[node_id] = images_output

#     return output_images


async def upload_image(input_path, name, server_address, image_type="input", overwrite=False):
    async with aiohttp.ClientSession() as session:
        form = FormData()
        form.add_field('image',
                       open(input_path, 'rb'),
                       filename=name,
                       content_type='image/png')
        form.add_field('type', image_type)
        form.add_field('overwrite', str(overwrite).lower())
        
        async with session.post(f"http://{server_address}/upload/image", data=form) as response:
            return await response.read()
        
# def upload_image(input_path, name, server_address, image_type="input", overwrite=False):
#   with open(input_path, 'rb') as file:
#     multipart_data = MultipartEncoder(
#       fields= {
#         'image': (name, file, 'image/png'),
#         'type': image_type,
#         'overwrite': str(overwrite).lower()
#       }
#     )

#     data = multipart_data
#     headers = { 'Content-Type': multipart_data.content_type }
#     request = urllib.request.Request("http://{}/upload/image".format(server_address), data=data, headers=headers)
#     with urllib.request.urlopen(request) as response:
#       return response.read()
  
import os

async def encode_images(images):
    encoded_images = []
    
    for node_id in images:
        for i, image_data in enumerate(images[node_id]):
            encoded_images.append(base64.b64encode(image_data).decode('utf-8'))
                
    return encoded_images

# async def save_images(images, folder, filename_root):
#     image_names = []
#     imgnum = 0
#     now = datetime.now()
#     timestamp_str = now.strftime("%Y%m%d%H%M%S")

#     os.makedirs(folder, exist_ok=True)  # Ensure the folder exists

#     for node_id in images:
#         for i, image_data in enumerate(images[node_id]):
#             imgnum += 1
#             file_path = os.path.join(folder, f"{filename_root}_{timestamp_str}_{imgnum}.png")
#             async with aiofiles.open(file_path, 'wb') as f:
#                 await f.write(image_data)
#                 image_names.append(os.path.basename(file_path))
#     return image_names

# def save_images(images, folder, filename_root):
#     image_names = []
#     imgnum = 0
#     now = datetime.now()
#     timestamp_str = now.strftime("%Y%m%d%H%M%S")
#     for node_id in images:
#         for i, image_data in enumerate(images[node_id]):
#             imgnum += 1
#             with open("{}/{}_{}_{}.png".format(folder, filename_root, timestamp_str,imgnum), 'wb') as f:
#                 f.write(image_data)
#                 image_names.append(path.basename(f.name))
#     return image_names



# async def get_character_photo(character_data, workflow, server_address, output_folder, seed=None, **kwargs):
#     then = datetime.now()
    
#     print(f"Loading workflow module: {path.basename(workflow)}")
#     spec = importlib.util.spec_from_file_location("workflow_module", workflow)
#     workflow_module = importlib.util.module_from_spec(spec)
#     spec.loader.exec_module(workflow_module)
    
#     print(f"Workflow module loaded in {datetime.now() - then}")
    
#     # Write the base64 encoded portrait to a temporary file
#     comfy_filename = f"{character_data.name}_portrait.png"  # You can customize the filename
#     temp_file_path = path.join(output_folder, comfy_filename)
    
#     with open(temp_file_path, "wb") as portrait_file:
#         portrait_file.write(base64.b64decode(character_data.portrait))
    
#     print(f"Uploading image: {comfy_filename}")
#     await upload_image(temp_file_path, comfy_filename, server_address, "input", True)
    
#     ## TODO: parameterize the width and height of the image from settings
#     w = kwargs.get("width", 768)
#     h = kwargs.get("height", 1024)
    
        
#     print(f"Evaluating workflow for {character_data.name} with width={w}, height={h}")
#     prompt = workflow_module.GetWorkflow(character_data, comfy_filename, width=w, height=h)
    
    
#     print(f"Connecting to Comfy server at {server_address} and client_id={session.get('client_id')}")
#     ws_url = f"ws://{server_address}/ws?clientId={session.get('client_id')}"
    
#     async with websockets.connect(ws_url) as comfy_ws:
#         #ping_task = asyncio.create_task(ping_ws(comfy_ws))
#         print(f"Submitting prompt for {character_data.name}")
#         images = await get_images(comfy_ws, prompt, server_address, session.get('client_id'))
    
    
#     now = datetime.now()
#     timestamp_str = now.strftime("%Y%m%d%H%M%S")
    
#     print(f"Images received in {now - then}s")
    
#     print(f"Saving {len(images)} images to {output_folder}")
#     #files = await save_images(images, output_folder, character_data.name)
#     files = await encode_images(images)
    
#     # Delete the temporary portrait file after the process is complete
#     try:
#         os.remove(temp_file_path)
#         print(f"Temporary file {temp_file_path} deleted successfully.")
#     except Exception as e:
#         print(f"Error deleting temporary file {temp_file_path}: {e}")
    
#     return files