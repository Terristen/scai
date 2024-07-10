from flask import Blueprint, request, jsonify, current_app
from utils.character_utils import load_characters, save_characters, get_cast_list
from utils.app_utils import load_settings, save_settings
from werkzeug.utils import secure_filename
import os


character_bp = Blueprint('character', __name__)

def get_settings():
    settings = current_app.config['SETTINGS']
    return settings

@character_bp.route('/get_characters', methods=['GET'])
def get_characters():
    cast_file = request.args.get("cast")
    if not cast_file:
        cast_file = current_app.config['SETTINGS']['default_cast']
    
    characters = load_characters(castname=cast_file, create=False)
    return jsonify(characters)


@character_bp.route('/save_username', methods=['POST'])
def save_username():
    new_username = request.json.get("username")
    if new_username:
        settings = get_settings()
        settings["username"] = new_username
        current_app.config['SETTINGS'] = settings
        save_settings()
        return jsonify({"success": True})
    else:
        return jsonify({"error": "Username not provided"}), 400
    

@character_bp.route('/get_cast_list', methods=['GET'])
def get_cast_list_handler():
    cast_files = get_cast_list()
    return jsonify(cast_files)

    
##route to take an uploaded cast file from a POST and save it to the cast_of_characters_directory
@character_bp.route('/upload_cast', methods=['POST'])
def upload_cast():
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