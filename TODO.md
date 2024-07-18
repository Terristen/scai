#Tasks to be completed

- do more to ensure SWF flag does not allow NSFW images to be returned
- convert backend calls to ComfyUI to be async... right now they interrupt the text-gen
- convert text-gen calls to be async
- create settings management tool in UI that allows editing or even uploading settings.json
- create cast-management tool that allows user to create a new cast, create characters for the cast, and save the cast to the server
- Create character creator tool that allows creating a new character but also generate a base picture using comfyui, or uploaded image
- create a user-management system to allow a user to have individual settings, casts, and user-name settings (beginning of multi-user features)
- create an agent-based workflow for determining when a new image should be created.
  - Should incorporate last generated scene as a contrast to latest scene; which means holding on to the generated prompt_data from the last run. Maybe send this back to client with the image name. This would make debugging easier for sure
  - should happen behind the scenes, kicked off by the addition of new character message, but doesn't always decide to return with an image... can decline.
  - Should have way to force image creation, no declining
- Need to add Director Instructions to user messages. these comments would not get displayed, but saved and sent to the server to be added to the character-message generation.
  - need to make sure it only persists in the next generation.
  - do we include it if the generation gets re-run?

