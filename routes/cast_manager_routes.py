import base64
import secrets
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

from concurrent.futures import ThreadPoolExecutor

import importlib.util
import os

from io import BytesIO
from PIL import Image

from aiohttp import MultipartWriter
from aiohttp import FormData

import requests

cmgr_bp = Blueprint('cmgr', __name__)

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

@cmgr_bp.before_app_request
async def ensure_client_id():
    if 'client_id' not in session:
        session['client_id'] = generate_client_id()

@cmgr_bp.route('/ollama_models', methods=['GET'])
def get_ollama_models(api_base_url=None):
    if api_base_url is None:
        api_base_url = get_settings().get("ollama_url")
        
    # Define the API endpoint
    endpoint = f"{api_base_url}/api/tags"
    
    print(f"ollama endpoint: ", endpoint)
    
    try:
        # Make the GET request
        response = requests.get(endpoint)
        print(f"response: ", response)
        # Check if the request was successful
        if response.status_code == 200:
            # Parse the JSON response
            models = response.json()
            return models
        else:
            print(f"Failed to retrieve models. Status code: {response.status_code}")
            return None
    except Exception as e:
        print(f"An error occurred: {e}")
        return None

# # Example usage
# api_base_url = "https://api.ollama.com"  # Replace with the actual base URL of the Ollama API
# models = get_ollama_models(api_base_url)
# if models:
#     print("Available models:", models)

def handle_file_upload(file, cache_directory):
    if file:
        # Secure the filename
        filename = secure_filename(file.filename)
        file_path = os.path.join(cache_directory, filename)
        
        # Save the file to the cache directory
        file.save(file_path)
        
        return file_path
    return None

#route to generate an image for a given character based on a fixed set of parameters only requires the character data object and the story array of messages
@cmgr_bp.route('/visualize', methods=['POST'])
async def generate():
    settings = get_settings()
    server_address = settings.get("comfy_ip")
    image_workflow = "user_content/workflows/quick_image.py"
    cache_directory = settings.get("cache_directory")
    default_photo_width = settings.get("default_photo_width", 768)
    default_photo_height = settings.get("default_photo_height", 1024)
    
    data = await request.json
    files = await request.files
    #print(data)
    args = {}
    
    if "portrait" in data and data["portrait"]:
        face_filename = save_base64_image(data["portrait"], cache_directory)
        args["portrait"] = face_filename
    else:
        args["portrait"] = None
    
    args["prompt"] = data.get("prompt", "a person")
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
    
    w = args.get("width", 768)
    h = args.get("height", 1024)
    
    sfw = args.get("sfw", False)
    prompt = args.get("prompt", "a person")
    age_adjust = args.get("age_adjust", 0)
    cfg = args.get("cfg", 3)
    steps = args.get("steps", 20)
    seed = args.get("seed")
    
    #print("age_adjust: ", age_adjust)    
    prompt, calculatedSeed = workflow_module.GetWorkflow(comfy_filename, width=w, height=h, sfw=sfw, prompt=prompt, age_adjust=age_adjust, cfg=cfg, steps=steps, seed=seed)
    
    
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




async def queue_prompt(prompt, server_address, client_id):
    p = {"prompt": prompt, "client_id": client_id}
    async with aiohttp.ClientSession() as session:
        async with session.post(f"http://{server_address}/prompt", json=p) as resp:
            return await resp.json()
        


async def get_image(filename, subfolder, folder_type, server_address):
    data = {"filename": filename, "subfolder": subfolder, "type": folder_type}
    url_values = urllib.parse.urlencode(data)
    async with aiohttp.ClientSession() as session:
        async with session.get(f"http://{server_address}/view?{url_values}") as resp:
            return await resp.read()



async def get_history(prompt_id, server_address):
    async with aiohttp.ClientSession() as session:
        async with session.get(f"http://{server_address}/history/{prompt_id}") as resp:
            return await resp.json()



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
        

async def encode_images(images):
    encoded_images = []
    
    for node_id in images:
        for i, image_data in enumerate(images[node_id]):
            encoded_images.append(base64.b64encode(image_data).decode('utf-8'))
                
    return encoded_images


async def save_images(images, folder, filename_root):
    image_names = []
    imgnum = 0
    now = datetime.now()
    timestamp_str = now.strftime("%Y%m%d%H%M%S")

    os.makedirs(folder, exist_ok=True)  # Ensure the folder exists

    for node_id in images:
        for i, image_data in enumerate(images[node_id]):
            imgnum += 1
            file_path = os.path.join(folder, f"{filename_root}_{timestamp_str}_{imgnum}.png")
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(image_data)
                image_names.append(os.path.basename(file_path))
    return image_names





