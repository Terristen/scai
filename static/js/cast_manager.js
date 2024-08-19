class CastManager {
    constructor() {
        this.initTemplates();
        this.initHelpers();
        this.initVariables();
        this.initialFetches();
        this.attachEventListeners(); // Attach event listeners for buttons and other elements
    }

    /**
     * Initialize Handlebars templates
     */
    initTemplates() {
        
    }

    /**
     * Register Handlebars helpers
     */
    initHelpers() {
        
    }

    /**
     * Initialize class variables
     */
    initVariables() {
        this.apiBaseUrl = '/cast_manager'; // Base URL for the API
    }

    /**
     * Perform initial data fetches
     */
    initialFetches() {
        
    }

    attachEventListeners() {
        document.getElementById("visualizeButton").addEventListener('click', () => this.handleGeneratePortrait());

        document.getElementById('age-adjustment').addEventListener('input', function() {
            document.getElementById('age-value').textContent = this.value;
        });

        document.getElementById('upload-button').addEventListener('click', () => {
            document.getElementById('portrait').click();
        });
        
        document.getElementById('portrait').addEventListener('change', async function() {
            if (this.files && this.files[0]) {
                const file = this.files[0];
                
                // Use FileReader to read the file and update the preview
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    document.getElementById('portrait-preview').src = e.target.result;
                };
        
                reader.readAsDataURL(file); // Convert the file to a data URL (Base64 string)
                
                // Optionally, convert the file to a Base64 string for further processing
                const base64String = await convertFileToBase64(file);
                document.getElementById('portrait').dataset.base64 = base64String; // Store the Base64 string in a data attribute
            }
        });


        this.initDragAndDrop();


        document.getElementById('add-to-collection-button').addEventListener('click', () => {
            const visualizerImage = document.getElementById('visualizer');
            const collectionContainer = document.getElementById('collection-container');
        
            const imageElement = document.createElement('div');
            imageElement.classList.add('collection-item');
            imageElement.style.position = "relative";
        
            const img = document.createElement('img');
            img.src = visualizerImage.src;
        
            const trashIcon = document.createElement('div');
            trashIcon.classList.add('trash-icon');
            trashIcon.innerHTML = '&times;';
        
            trashIcon.addEventListener('click', () => {
                imageElement.remove();
            });
        
            img.addEventListener('click', () => {
                this.showFullscreenImage(img.src);
            });
        
            imageElement.appendChild(img);
            imageElement.appendChild(trashIcon);
            collectionContainer.appendChild(imageElement);
        });
    }

    showFullscreenImage(src) {
        const overlay = document.createElement('div');
        overlay.classList.add('fullscreen-overlay');
    
        const img = document.createElement('img');
        img.src = src;
    
        overlay.appendChild(img);
        overlay.addEventListener('click', () => {
            overlay.remove();
        });
    
        document.body.appendChild(overlay);
    }
    
    async handleGeneratePortrait() {
        const prompt = document.getElementById("prompt").value;
        const portraitFile = document.getElementById("portrait").files[0];
        const ageAdjustment = document.getElementById("age-value").value;
        const sfw = document.getElementById("sfw").checked;
        const width = document.getElementById("width").value;
        const height = document.getElementById("height").value;
    

        // Check if there's a Base64 string from drag-and-drop
        let portraitBase64 = document.getElementById("portrait").dataset.base64;
    
        // If there's no Base64 from drag-and-drop, check if there's a file selected
        if (!portraitBase64 && document.getElementById("portrait").files[0]) {
            const file = document.getElementById("portrait").files[0];
            portraitBase64 = await convertFileToBase64(file);
        }
        
    
        const data = {
            prompt: prompt,
            age_adjust: ageAdjustment, // Match backend key name
            sfw: sfw,
            portrait: portraitBase64, // This will be null if no file is selected
            portrait_width: width,
            portrait_height: height
        };
        

        try {
            const response = await fetch(`${this.apiBaseUrl}/visualize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });
    
            if (!response.ok) {
                throw new Error('Image generation failed');
            }
    
            const result = await response.json();
    
            if (result.files.length > 0) {
                const url = `/cache/${result.files[0]}`;
                this.updatePortrait(url);
            }
        } catch (error) {
            console.error('Image generation failed:', error);
        }
    }
    
    /**
     * Convert file to Base64 string
     * @param {File} file - The file to convert
     * @returns {Promise<string>} - A promise that resolves to the Base64 string
     */
    convertFileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });
    }

    /**
     * Update the UI with the generated portrait image
     * @param {string} url - root path to new image
     */
    updatePortrait(url) {
        const imageContainer = document.getElementById("visualizer");
        imageContainer.src = url; // Update the image source with the first file
    }


    /**
     * Drag and Drop Initialization
     */
    initDragAndDrop() {
        const visualizerImage = document.getElementById('visualizer');
        const portraitPreview = document.getElementById('portrait-preview');
        const portraitInput = document.getElementById('portrait');

        // Enable dragging from the visualizer image
        visualizerImage.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', visualizerImage.src); // Set the image source as transferable data
        });

        // Allow dropping over the preview area
        portraitPreview.addEventListener('dragover', (e) => {
            e.preventDefault(); // Prevent the default to allow drop
        });

        // Handle the drop event
        portraitPreview.addEventListener('drop', async (e) => {
            e.preventDefault();
            const imageUrl = e.dataTransfer.getData('text/plain'); // Get the image URL from the drag event
            

            try {
                // Fetch the image as a blob and convert it to a file object
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                const file = new File([blob], "dropped_image.png", { type: blob.type });

                // Convert the file to a Base64 string and update the preview
                const base64String = await this.convertFileToBase64(file);
                portraitPreview.src = base64String; // Update the preview image
                portraitInput.dataset.base64 = base64String; // Store the Base64 string in a data attribute for form submission
            } catch (error) {
                console.error('Error during drag-and-drop:', error);
            }
        });

        
    }

}