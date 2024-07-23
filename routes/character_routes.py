from quart import Blueprint, request, jsonify, current_app
from utils.character_utils import load_character_cast, load_characters, save_characters, get_cast_list
from utils.app_utils import load_settings, save_settings
from werkzeug.utils import secure_filename
import os


character_bp = Blueprint('character', __name__)

def get_settings():
    settings = current_app.config['SETTINGS']
    return settings

@character_bp.route('/get_cast', methods=['GET'])
async def get_cast():
    cast_file = request.args.get("cast")
    if not cast_file:
        cast_file = current_app.config['SETTINGS']['default_cast']
    
    cast = load_character_cast(castname=cast_file)
    return jsonify(cast)


@character_bp.route('/save_username', methods=['POST'])
async def save_username():
    data = await request.json
    new_username = data.get("username")
    if new_username:
        settings = get_settings()
        settings["username"] = new_username
        current_app.config['SETTINGS'] = settings
        save_settings()
        return jsonify({"success": True})
    else:
        return jsonify({"error": "Username not provided"}), 400
    

@character_bp.route('/get_cast_list', methods=['GET'])
async def get_cast_list_handler():
    cast_files = get_cast_list()
    return jsonify(cast_files)

    
##route to take an uploaded cast file from a POST and save it to the cast_of_characters_directory
@character_bp.route('/upload_cast', methods=['POST'])
async def upload_cast():
    if 'cast_file' not in request.files:
        return jsonify({"error": "No cast file provided"}), 400
    
    cast_file = request.files['cast_file']
    
    if cast_file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if cast_file and cast_file.filename.endswith('.json'):
        filename = secure_filename(cast_file.filename)
        settings = get_settings()
        cast_folder = settings.get("cast_of_characters_directory", "user_content/cast/")
        
        if not os.path.exists(cast_folder):
            os.makedirs(cast_folder)
        
        cast_path = os.path.join(cast_folder, filename)
        
        cast_file.save(cast_path)
        
        return jsonify({"success": True})
    else:
        return jsonify({"error": "Invalid file format. Only JSON files are allowed."}), 400
    
    
    ##route to take an updated cast object and save it to the cast file
@character_bp.route('/save_cast', methods=['POST'])
async def save_cast():
    data = await request.json
    cast = data.get("castData")
    cast_file = data.get("castFileName")
    
    if not cast:
        return jsonify({"error": "No cast object provided"}), 400
    
    if not cast_file:
        return jsonify({"error": "No cast file provided"}), 400
    
    save_characters(cast, cast_file)
    
    return jsonify({"success": True})