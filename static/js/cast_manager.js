class CastManager {
    constructor() {
        this.currentCast = {
            title: "New Cast",
            lore: "",
            setting: "",
            cast: [
                {
                    name: "New Character",
                    age: 0,
                    description: "",
                    personality: "",
                    icon: "/static/images/default.jpg",
                    model: "",
                    instructions: "",
                    sfw: true,
                    pictures: []
                }
            ]
        }; // Store the current cast data
        this.currentActorIndex = 0; // Store the current actor index

        this.initTemplates();
        this.initHelpers();
        this.initVariables();
        this.initialFetches();
        this.attachEventListeners(); // Attach event listeners for buttons and other elements
        this.initBindings(); // Initialize data bindings
    }

    get currentActor() {
        if(this.currentCast && this.currentCast.cast.length > 0){
            this.currentActorIndex = Math.min(this.currentActorIndex, this.currentCast.cast.length - 1); 
            return this.currentCast.cast[this.currentActorIndex];
        }
        return null;
    }



    // Method to initialize bindings
    initBindings() {
        // Query all elements with the data-bind attribute
        const bindableElements = document.querySelectorAll('[data-bind]');

        // Attach change listeners to each element
        bindableElements.forEach(element => {
            const bindPath = element.getAttribute('data-bind');
            element.addEventListener('input', (event) => this.updateModel(event, bindPath));
        });

        // Initialize the UI with the current data
        this.updateUI();
    }

    // Method to bind select elements based on custom attributes
    bindSelectElements() {
        const selectElements = document.querySelectorAll('select[array-bind]');

        selectElements.forEach(element => {
            const arrayBind = element.getAttribute('array-bind');
            const valueField = element.getAttribute('value') || 'index'; // Default to using index
            const displayField = element.getAttribute('display');

            this.populateSelect(element, arrayBind, valueField, displayField);

            // Handle change event to update current actor index
            element.addEventListener('change', (e) => {
                this.currentActorIndex = parseInt(e.target.value, 10);
                this.updateUI();
                this.loadCurrentActorImages();
            });
        });
    }

    // Method to populate a select element
    populateSelect(element, arrayBind, valueField, displayField) {
        const [object, field] = arrayBind.split('.');
        let reference = null;
        if(object === 'cast') {
            reference = this.currentCast;
        } else if (object === 'actor') {
            reference = this.currentActor;
        }
        
        if (!reference || !reference[field]) {
            return;
        }

        const dataArray = reference[field];

        
        // Clear existing options
        element.innerHTML = '<option disabled selected>Select a character from the cast...</option>';

        // Populate the select options
        dataArray.forEach((item, index) => {
            const option = document.createElement('option');
            option.value = valueField === 'index' ? index : item[valueField];
            option.textContent = item[displayField];
            if (index === this.currentActorIndex) {
                option.selected = true;
            }
            element.appendChild(option);
        });
    }

    updateModel(event, bindPath) {
        const [object, property] = bindPath.split('.');

        if (object === 'cast') {
            if (event.target.type === 'checkbox') {
                this.currentCast[property] = event.target.checked;
            } else {
                this.currentCast[property] = event.target.value;
            }
        } else if (object === 'actor') {
            const currentActor = this.currentActor;
            if (event.target.type === 'checkbox') {
                currentActor[property] = event.target.checked;
            } else {
                currentActor[property] = event.target.value;
            }
        }
    }

    updateCollectionFromPictures() {
        const currentActor = this.currentActor;
        if (currentActor) {
            const collectionContainer = document.getElementById('collection-container');
            const images = Array.from(collectionContainer.querySelectorAll('img')).map(img => img.src);
            currentActor.pictures = images;
        }
    }

    updateUI() {
        // Set the initial values of the inputs from the model
        const bindableElements = document.querySelectorAll('[data-bind]');

        bindableElements.forEach(element => {
            const bindPath = element.getAttribute('data-bind');
            const [object, property] = bindPath.split('.');

            if (object === 'cast' && this.currentCast) {
                if (element.type === 'checkbox') {
                    element.checked = this.currentCast[property] || false;
                } else {
                    element.value = this.currentCast[property] || '';
                }
            } else if (object === 'actor' && this.currentActor) {
                const ca = this.currentActor;
                if (element.type === 'checkbox') {
                    element.checked = ca[property] || false;
                } else {
                    element.value = ca[property] || '';
                }
            }
        });
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
        this.default_image = '/static/images/default.jpg';
        this.modelList = [];
    }

    /**
     * Perform initial data fetches
     */
    initialFetches() {
        this.getOllamaModels()
            .then(r => { 
                this.modelList = r;
                this.populateActorModelList();
            });
    }

    attachEventListeners() {
        document.getElementById("visualizeButton").addEventListener('click', () => this.handleGeneratePortrait());

        document.getElementById('age-adjustment').addEventListener('input', function() {
            document.getElementById('age-value').textContent = this.value;
        });

        document.getElementById('upload-button').addEventListener('click', () => {
            document.getElementById('portrait').click();
        });
        

        // Listen for the CTRL+Enter keypress
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault(); // Prevent any default action
                visualizeButton.click(); // Trigger the visualize button
            }
        });

        // Event listener for portrait file change (file upload)
        document.getElementById('portrait').addEventListener('change', async (event) => {
            if (event.target.files && event.target.files[0]) {
                const file = event.target.files[0];
                
                // Convert the file to a Base64 string and update the preview
                const base64String = await this.convertFileToBase64(file);
                document.getElementById('portrait-preview').src = base64String; // Update the preview image
                document.getElementById('portrait').dataset.base64 = base64String; // Store the Base64 string in a data attribute for form submission
                
                // Clear any previously dragged image data
                document.getElementById('portrait').value = ''; // Reset the file input field

                this.updateCurrentActorPictures(); // Update the current actor's icon immediately
            }
        });

        
        document.getElementById('portrait-clear-button').addEventListener('click', () => {
            this.clearPortraitValue();
            this.updateCurrentActorPictures();
        });

        document.getElementById("last-seed").addEventListener('click', () => {
            this.populateLastSeed();
        });


        this.initDragAndDrop();

        this.initAspectRatios();

        // Event listener for cast file upload
        document.getElementById('cast-upload').addEventListener('change', (event) => this.loadCastFile(event));
        
        // Event listener for downloading cast file
        document.getElementById('download-cast').addEventListener('click', () => this.downloadCastFile());

        document.getElementById('load-cast-button').addEventListener('click', () => {
            document.getElementById('cast-upload').click();
        });

        document.getElementById('cast-list').addEventListener('change', (e) => {
            this.currentActorIndex = parseInt(e.target.value, 10);
            this.updateUI(); // This will also load images and update the form field
        });

        document.getElementById('new-actor-button').addEventListener('click', () => {  
            this.createNewActor();
        });
    }

    createNewActor() {
        this.currentCast.cast.push({
            name: "New Character",
            age: 0,
            description: "",
            personality: "",
            icon: "/static/images/default.jpg",
            model: "",
            instructions: "",
            sfw: true,
            pictures: []
        });
        this.currentActorIndex = this.currentCast.cast.length - 1;
        this.updateUI();
        this.bindSelectElements();
        this.loadCurrentActorImages();
    }

    populateActorModelList(){
        const modelList = document.getElementById('actor-model');
        for (const model of this.modelList) {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = `(${model.details.family} - ${model.details.parameter_size}) ${model.name}`;
            modelList.appendChild(option);
        }
    }


    //loads a cast file into the manager
    async loadCastFile(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    this.currentCast = JSON.parse(e.target.result);
                    this.currentActorIndex = 0; // Reset the actor index

                    //this.bindCastFields();
                    //this.selectActor(0); // Automatically select the first actor
                    //debugger;
                    this.updateUI();
                    this.bindSelectElements();
                    this.loadCurrentActorImages(); // Update the UI with the current actor's images
                } catch (error) {
                    console.error("Error parsing cast file:", error);
                }
            };
            reader.readAsText(file);

            
        }
    }

    

    //update the pictures array from the collection container
    addToPictures() {
        const currentActor = this.currentActor
        if (currentActor) {
            const collectionContainer = document.getElementById('collection-container');
            const images = Array.from(collectionContainer.querySelectorAll('img')).map(img => img.src);
            this.currentActor.pictures = images;
        }
    }

    //update the icon field from the portrait preview
    updatePortraitBase64(base64) {
        const currentActor = this.currentActor
        if (currentActor) {
            currentActor.icon = base64; // Set the base64 encoded data as the icon
        }
    }

    downloadCastFile() {
        const castData = JSON.stringify(this.currentCast, null, 2); // Pretty print JSON
        const blob = new Blob([castData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentCast.title || 'cast'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }



    initAspectRatios() {
        const aspectRatioSelect = document.getElementById('aspect-ratio');
        const widthInput = document.getElementById('width');
        const heightInput = document.getElementById('height');

        const aspectRatios = [
            { label: '1:1 (1024x1024)', ratio: 1, width: 1024, height: 1024 },
            { label: '4:3 (1024x768)', ratio: 4/3, width: 1024, height: 768 },
            { label: '16:9 (1024x576)', ratio: 16/9, width: 1024, height: 576 },
            { label: '3:2 (1024x682)', ratio: 3/2, width: 1024, height: 682 },
            { label: '2:3 (768x1024)', ratio: 2/3, width: 768, height: 1024 },
            { label: '9:16 (576x1024)', ratio: 9/16, width: 576, height: 1024 },
            { label: '3:4 (768x1024)', ratio: 3/4, width: 768, height: 1024 },

            { label: '1:1 (1280x1280)', ratio: 1, width: 1280, height: 1280 },
            { label: '4:3 (1280x768)', ratio: 4/3, width: 1280, height: 960 },
            { label: '16:9 (1280x576)', ratio: 16/9, width: 1280, height: 720 },
            { label: '3:2 (1280x682)', ratio: 3/2, width: 1280, height: 854 },
            { label: '2:3 (768x1280)', ratio: 2/3, width: 854, height: 1280 },
            { label: '9:16 (576x1280)', ratio: 9/16, width: 720, height: 1280 },
            { label: '3:4 (768x1280)', ratio: 3/4, width: 960, height: 1280 },
        ];

        // Populate the select box with options
        aspectRatios.forEach((item, index) => {
            const option = document.createElement('option');
            option.value = JSON.stringify({ ratio: item.ratio, width: item.width, height: item.height });
            option.textContent = item.label;
            aspectRatioSelect.appendChild(option);
        });

        // Handle the selection change
        aspectRatioSelect.addEventListener('change', (e) => {
            const selectedValue = JSON.parse(e.target.value);

            if (selectedValue) {
                widthInput.value = selectedValue.width;
                heightInput.value = selectedValue.height;
            }
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
        const ageAdjustment = parseFloat(document.getElementById('age-value').textContent);
        const sfw = document.getElementById("actor-sfw").checked;
        const width = document.getElementById("width").value;
        const height = document.getElementById("height").value;
        const cfg = document.getElementById("cfg").value;
        const steps = document.getElementById("steps").value;
        const seed = document.getElementById("seed").value;
        
        if (isNaN(parseInt(seed))) {
            seed = -1;
        }

        // Check if there's a Base64 string from drag-and-drop
        let portraitBase64 = document.getElementById("portrait").dataset.base64;
    
        // If there's no Base64 from drag-and-drop, check if there's a file selected
        if (!portraitBase64 && document.getElementById("portrait").files[0]) {
            const file = document.getElementById("portrait").files[0];
            portraitBase64 = await this.convertFileToBase64(file);
        }
        
        
    
        const data = {
            prompt: prompt,
            age_adjust: ageAdjustment, // Match backend key name
            sfw: sfw,
            portrait: portraitBase64, // This will be null if no file is selected
            portrait_width: width,
            portrait_height: height,
            cfg:cfg,
            steps:steps,
            seed:seed
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
            
            if (result.images.length > 0) {
                /* format:
                {
                    "images": [base_64_string],
                    "seed": seed used to generate the images
                }
                */

                this.updatePortrait_base64(result.images[0]);
                this.updateLastSeed(result.seed);
            }
        } catch (error) {
            console.error('Image generation failed:', error);
        }
    }
    
    updateLastSeed(seed) {
        document.getElementById("last-seed").alt = seed;
    }

    populateLastSeed() {
        const lastSeed = document.getElementById("last-seed");
        const seed = lastSeed.alt;
        if (seed) {
            document.getElementById("seed").value = seed;
        }
    }

    clearPortraitValue() {
        document.getElementById('portrait-preview').src = this.default_image;
        document.getElementById('portrait').dataset.base64 = ''; // Clear the Base64 string
    }


    /**
     * Convert file to Base64 string
     * @param {File} file - The file to convert
     * @returns {Promise<string>} - A promise that resolves to the Base64 string
     */
    async convertFileToBase64(file) {
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

    updatePortrait_base64(base64) {
        const imageContainer = document.getElementById("visualizer");
        imageContainer.src = `data:image/png;base64,${base64}`; // Prepend the base64 string with the correct data URI scheme
    }

    /**
     * Drag and Drop Initialization
     */
    initDragAndDrop() {
        const visualizerImage = document.getElementById('visualizer');
        const portraitPreview = document.getElementById('portrait-preview');
        const portraitInput = document.getElementById('portrait');
        const collectionContainer = document.getElementById('collection-container');
        const visualizeButton = document.getElementById('visualizeButton');
    
        // Enable dragging the visualizer image
        visualizerImage.draggable = true;
        portraitPreview.draggable = true; // Enable dragging the portrait preview image
    
        // Handle dragging from the visualizer image
        visualizerImage.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', visualizerImage.src); // Set the visualizer image source as transferable data
        });
    
        // Handle dragging from the portrait preview image
        portraitPreview.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', portraitPreview.src); // Set the portrait preview image source as transferable data
        });
    
        // Allow dropping over the preview area
        portraitPreview.addEventListener('dragover', (e) => {
            e.preventDefault(); // Prevent the default to allow drop
        });
    
        // Handle the drag over event on the collection container
        collectionContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            collectionContainer.classList.add('drag-over'); // Add visual feedback
        });
    
        // Handle the drag leave event to remove the visual feedback
        collectionContainer.addEventListener('dragleave', () => {
            collectionContainer.classList.remove('drag-over');
        });
    
        // Handle the drop event on the collection container
        collectionContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            collectionContainer.classList.remove('drag-over');
    
            const imageSrc = e.dataTransfer.getData('text/plain');
            if (imageSrc) {
                this.addToCollection(imageSrc);
                this.updateCurrentActorPictures(); // Immediately update the actor's data
            }
        });
        
        // Handle the drop event on the portrait preview area
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

                // Clear any previously uploaded file data
                portraitInput.value = ''; // Reset the file input field

                const currentActor = this.currentActor;
                currentActor.icon = base64String
                this.loadCurrentActorImages(); // Update the UI
                this.updateCurrentActorPictures(); // Immediately update the actor's data
            } catch (error) {
                console.error('Error during drag-and-drop:', error);
            }
        });

       
    }
    
    syncPortraitPreview(base64String) {
        //performing synchronization of the portrait preview and the portrait input
        const portraitPreview = document.getElementById('portrait-preview');
        const portrait = document.getElementById('portrait');

        portraitPreview.src = base64String; // Update the preview image
        portrait.dataset.base64 = base64String; // Store the Base64 string in a data attribute for form submission
    }


    addToCollection(imageSrc) {
        const collectionContainer = document.getElementById('collection-container');
    
        const imageElement = document.createElement('div');
        imageElement.classList.add('collection-item');
        imageElement.style.position = "relative";
    
        const img = document.createElement('img');
        img.src = imageSrc; // Use the correct image source
    
        const trashIcon = document.createElement('div');
        trashIcon.classList.add('trash-icon');
        trashIcon.innerHTML = '&times;';
    
        trashIcon.addEventListener('click', () => {
            imageElement.remove();
            this.updateCurrentActorPictures(); // Update the pictures array immediately
        });
    
        img.addEventListener('click', () => {
            this.showFullscreenImage(img.src);
        });
    
        imageElement.appendChild(img);
        imageElement.appendChild(trashIcon);
        collectionContainer.appendChild(imageElement);
    }

    async getOllamaModels(){
        try {
            const response = await fetch(`${this.apiBaseUrl}/ollama_models`);
            if (!response.ok) {
                throw new Error('Failed to fetch Ollama models');
            }
            const result = await response.json();
            return result.models;
        } catch (error) {
            console.error('Failed to fetch Ollama models:', error);
            return
        }
    }

    loadCurrentActorImages() {
        const portraitPreview = document.getElementById('portrait-preview');
        const visualizer = document.getElementById('visualizer');
        const portraitInput = document.getElementById('portrait');
        const currentActor = this.currentActor;
    
        //console.log("Loading current actor images", currentActor);
    
        const icon = currentActor.icon || '/static/images/default.jpg';
        portraitPreview.src = icon;
        visualizer.src = icon;
    
        // Debug: Check what is being set in portrait preview and visualizer
        //console.log("Icon set to:", icon);
    
        // If the icon is a base64 string, update the portrait input field
        if (icon.startsWith('data:image/')) {
            portraitInput.dataset.base64 = icon;
            //console.log("Setting base64 in portrait input dataset");
        } else {
            portraitInput.value = '';
            //console.log("Clearing portrait input value");
        }
    
        // Clear the current collection container
        const collectionContainer = document.getElementById('collection-container');
        collectionContainer.innerHTML = '';
    
        if (!currentActor.pictures) {
            currentActor.pictures = [];
        }
    
        // Load pictures into the collection container
        currentActor.pictures.forEach((picture, index) => {
            const imageElement = document.createElement('div');
            imageElement.classList.add('collection-item');
            imageElement.style.position = "relative";
    
            const img = document.createElement('img');
            img.src = picture;
    
            const trashIcon = document.createElement('div');
            trashIcon.classList.add('trash-icon');
            trashIcon.innerHTML = '&times;';
    
            trashIcon.addEventListener('click', () => {
                currentActor.pictures.splice(index, 1); // Remove image from array
                this.loadCurrentActorImages(); // Refresh the collection
                this.updateCurrentActorPictures(); // Update pictures immediately
            });
    
            img.addEventListener('click', () => {
                this.showFullscreenImage(img.src);
            });
    
            imageElement.appendChild(img);
            imageElement.appendChild(trashIcon);
            collectionContainer.appendChild(imageElement);
        });
    
        //console.log("Loaded images into collection:", currentActor.pictures);
    }
    

    updateCurrentActorPictures() {
        const portraitPreview = document.getElementById('portrait-preview');
        const collectionContainer = document.getElementById('collection-container');
        const currentActor = this.currentActor;
    
        // Update the portrait as the icon
        currentActor.icon = portraitPreview.src;
        //console.log("Updated icon to:", currentActor.icon);
    
        // Update all images in the collection container to the pictures array
        currentActor.pictures = Array.from(collectionContainer.querySelectorAll('img')).map(img => img.src);
    
        //console.log("Updated pictures array:", currentActor.pictures);
    }
    

    

}