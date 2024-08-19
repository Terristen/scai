from quart import Quart, render_template, send_from_directory, url_for, jsonify, request
from utils.character_utils import load_characters, save_characters
from utils.app_utils import load_settings
import atexit
import os
import glob
import secrets

def create_app():
    app = Quart(__name__)

    SETTINGS = load_settings()
    app.config['SETTINGS'] = SETTINGS

    cast_photos_directory = SETTINGS.get("cast_photos_directory", "user_content/cast_photos/")
    temp_cache_directory = "user_content/cache/"
        
    app.secret_key = secrets.token_urlsafe(16)        

    from routes.chat_routes import chat_bp
    from routes.character_routes import character_bp
    from routes.comfy_routes import comfy_bp
    from routes.cast_manager_routes import cmgr_bp

    app.register_blueprint(chat_bp, url_prefix='/chat')
    app.register_blueprint(character_bp, url_prefix='/character')
    app.register_blueprint(comfy_bp, url_prefix='/comfy')
    app.register_blueprint(cmgr_bp, url_prefix='/cast_manager')

    @app.route('/')
    async def home():
        cast_photo_base_url = url_for('cast_photos', filename='')
        temp_cache_url = url_for('cache', filename='')
        icon = "character_icon.png"  # Replace with the actual icon name
        return await render_template('chat.html', default_username=SETTINGS.get("username",""), icon=icon, cast_photo_base_url=cast_photo_base_url, temp_cache_url=temp_cache_url)

    @app.route('/cast_manager')
    async def cast_manager():
        cast_photo_base_url = url_for('cast_photos', filename='')
        temp_cache_url = url_for('cache', filename='')
        return await render_template('cast_manager.html', cast_photo_base_url=cast_photo_base_url, temp_cache_url=temp_cache_url)
    
    @app.route('/cast_photos/<filename>')
    async def cast_photos(filename):
        return await send_from_directory(cast_photos_directory, filename)

    
    @app.route('/cache/<filename>')
    async def cache(filename):
        return await send_from_directory(temp_cache_directory, filename)
    
    
    def cleanup_cache_directory():
        """Delete all files in the cache directory."""
        files = glob.glob(os.path.join(temp_cache_directory, '*'))
        for f in files:
            try:
                os.remove(f)
                print(f"Deleted file: {f}")
            except OSError as e:
                print(f"Error deleting file {f}: {e}")
    
    atexit.register(cleanup_cache_directory)
    
    return app




if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)
