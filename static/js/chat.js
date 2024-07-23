class Chat {
    constructor() {
        this.initTemplates();
        this.initHelpers();
        this.initVariables();
        this.initialFetches();
    }

    /**
     * Initialize Handlebars templates
     */
    initTemplates() {
        this.chatTemplate = Handlebars.compile(document.getElementById('chat-template').innerHTML);
        this.characterTemplate = Handlebars.compile(document.getElementById('character-template').innerHTML);
    }

    /**
     * Register Handlebars helpers
     */
    initHelpers() {
        Handlebars.registerHelper('displayName', (role, username, character) => {
            return role === 'user' ? username : character;
        });

        Handlebars.registerHelper('iconRender', (icon) => {
            return window.cast_photo_base_url + (icon === '' ? 'default.jpg' : icon);
        });

        Handlebars.registerHelper('markdown', (text) => {
            return new Handlebars.SafeString(marked.parse(text));
        });
    }

    /**
     * Initialize class variables
     */
    initVariables() {
        this.masterConversation = [];
        this.currentCast = 'default.json';
        this.characters = [];
        this.images = [];
        this.currentImageIndex = 0;
        this.title = '';
        this.lore = '';
        this.setting = '';
    }

    /**
     * Perform initial data fetches
     */
    initialFetches() {
        this.renderChat();
        this.fetchCharacters();
    }

    /**
     * Render chat messages
     * @param {Array} messages - Array of messages to render
     */
    renderChat(messages = []) {
        if (messages.length === 0) {
            messages = this.masterConversation;
        }
        const username = document.getElementById('username').value || 'User';
        const chatArea = document.getElementById('chatArea');
        chatArea.innerHTML = this.chatTemplate({ messages, username });
        chatArea.scrollTop = chatArea.scrollHeight;

        if (hljs) {
            hljs.highlightAll();
        }
    }

    /**
     * Render character list
     */
    renderCharacters() {
        const characterList = document.getElementById('characterList');
        characterList.innerHTML = this.characterTemplate({ characters: this.characters });
        document.querySelectorAll('.character-card').forEach(card => {
            card.addEventListener('click', () => {
                const characterName = card.dataset.character;
                const character = this.characters.find(c => c.name === characterName);
                character.selected = !character.selected;
                this.renderCharacters();
            });
        });
    }

    /**
     * Fetch character data and cast metadata
     * @param {string} cast - Cast file name
     */
    fetchCharacters(cast = "default.json") {
        const url = new URL('/character/get_cast', window.location.origin);
        url.searchParams.append('cast', encodeURIComponent(cast));
        fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            this.title = data.title;
            this.lore = data.lore;
            this.setting = data.setting;
            this.characters = data.cast.map(character => ({
                ...character,
                selected: false,
                personalitySnippet: `${character.personality.substring(0, 20)}...`
            }));
            this.renderCharacters();
        });
    }

    /**
     * Send a message
     * @param {boolean} forcePass - Whether to force pass the message
     */
    sendMessage(forcePass = false) {
        const message = document.getElementById('message').value.trim();
        const username = document.getElementById('username').value || 'User';
        const respondents = this.characters.filter(character => character.selected);

        if (!forcePass && message) {
            const newMsg = { role: "user", content: message, character: username };
            this.masterConversation.push(newMsg);
            this.renderChat();
            document.getElementById('message').value = '';
            this.autoGrowTextArea();
        }

        if(respondents.length === 0) {
            return;
        }

        fetch('/chat/get_character_message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                respondents,
                conversation: this.masterConversation,
                title: this.title,
                lore: this.lore,
                setting: this.setting
            }),
        })
        .then(response => response.json())
        .then(data => {
            this.masterConversation.push(data.assistant_message);
            this.renderChat();
            const answeringCharacter = this.characters.find(character => character.name === data.assistant_message.character);
            if (answeringCharacter) {
                this.addPortraitImage(window.cast_photo_base_url + answeringCharacter.icon);
            }
        });
    }

    /**
     * Toggle character list visibility
     */
    toggleCharacterList() {
        const characterList = document.getElementById('characterListHolder');
        characterList.classList.toggle('show');
    }

    /**
     * Regenerate the last message
     */
    regenerateLastMessage() {
        this.masterConversation.pop();
        this.sendMessage(true);
    }

    /**
     * Delete the last message
     */
    deleteLastMessage() {
        this.masterConversation.pop();
        this.renderChat();
    }

    /**
     * Replace the last message with the current input value
     */
    replaceLastMessage() {
        const replacementMessage = document.getElementById('message').value;
        document.getElementById('message').value = '';
        this.autoGrowTextArea();

        this.masterConversation[this.masterConversation.length - 1].content = replacementMessage;
        this.renderChat();
    }

    /**
     * Update send button text based on message input
     */
    handleSendButtonText() {
        const sendButton = document.getElementById('sendButton');
        const messageInput = document.getElementById('message');
        sendButton.textContent = messageInput.value.trim() ? 'Send' : 'Pass';
    }

    /**
     * Save the username to the server
     */
    handleUsernameSave() {
        const username = document.getElementById('username').value;
        fetch('/character/save_username', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username }),
        })
        .then(response => response.json());
    }

    /**
     * Copy the last message to the input box
     */
    copyLastMessageToInput() {
        const lastMessage = this.masterConversation[this.masterConversation.length - 1].content;
        document.getElementById('message').value = lastMessage;
        this.autoGrowTextArea();
    }

    /**
     * Automatically adjust the height of the textarea
     */
    autoGrowTextArea() {
        const messageElement = document.getElementById('message');
        messageElement.style.height = 'auto';
        messageElement.style.height = `${Math.min(messageElement.scrollHeight, 200)}px`;
    }

    /**
     * Toggle shortcut menu visibility
     */
    toggleShortcutMenu() {
        const menuContent = document.querySelector('.shortcut-menu-content');
        menuContent.style.display = menuContent.style.display === 'none' ? 'block' : 'none';
    }

    /**
     * Get the list of character casts
     * @returns {Promise<Array>} - List of casts
     */
    async getCastList() {
        const response = await fetch('/character/get_cast_list', { method: 'GET' });
        return response.json();
    }

    /**
     * Populate the cast selector dropdown
     */
    async populateCastSelector() {
        const castSelector = document.getElementById('castSelector');
        castSelector.innerHTML = '';

        const casts = await this.getCastList();
        casts.forEach(cast => {
            const option = document.createElement('option');
            option.value = cast;
            option.textContent = cast.split(".")[0];
            if (cast === this.currentCast) {
                option.selected = true;
            }
            castSelector.appendChild(option);
        });
    }

    /**
     * Load a specific cast
     * @param {string} filename - Cast filename
     */
    async loadCast(filename = '') {
        if (!filename) {
            filename = document.getElementById('castSelector').value;
        }

        this.currentCast = filename;
        this.fetchCharacters(this.currentCast);
    }

    /**
     * Handle cast upload form
     */
    async handleCastUploadForm() {
        const castUpload = document.getElementById('castUpload');
        const file = castUpload.files[0];
        if (file) {
            const filename = file.name;
            const formData = new FormData();
            formData.append('cast_file', file);

            try {
                const response = await fetch('/character/upload_cast', {
                    method: 'POST',
                    body: formData,
                });
                const data = await response.json();
                console.log('Success:', data);
                await this.loadCast(filename);
                await this.populateCastSelector();
            } catch (error) {
                console.error('Error:', error);
            }
        }
    }

    /**
     * Toggle cast management window visibility
     */
    toggleCastWindow() {
        const popup = document.getElementById('castManagementPopup');
        const isDisplayed = popup.style.display !== 'none';
        popup.style.display = isDisplayed ? 'none' : 'flex';
        if (!isDisplayed) {
            this.populateCastSelector();
        }
    }

    /**
     * Get a character by name
     * @param {string} name - Character name
     * @returns {Object} - Character object
     */
    getCharacterByName(name) {
        return this.characters.find(character => character.name === name);
    }

    /**
     * Image Strip Functions
     */

    /**
     * Toggle image strip visibility
     */
    toggleImageStrip() {
        document.getElementById('imageStrip').classList.toggle('show');
    }

    /**
     * Add portrait image to the portrait container
     * @param {string} imageUrl - Image URL
     */
    addPortraitImage(imageUrl) {
        document.getElementById('portraitContainer').innerHTML = `<img src="${imageUrl}" alt="Portrait">`;
    }

    /**
     * Add generated image to the container
     * @param {string} imageUrl - Image URL
     */
    addGeneratedImage(imageUrl) {
        const tpl = Handlebars.compile(document.getElementById('image-template').innerHTML);
        const newImage = tpl({ url: imageUrl });
        const cont = document.getElementById('generatedImages');
        cont.innerHTML += newImage;
        cont.scrollTop = cont.scrollHeight;
        this.images.push(imageUrl);
        this.addImageClickListeners();
    }

    /**
     * Generate character image
     */
    generateCharacterImage(width = 768, height = 1024) {
        console.log("Generating Character Image");
        const statusIndicator = document.getElementById('generationStatus');
        
        statusIndicator.className = 'generation-status loading';

        let lastCharacter = null;

        for (let i = this.masterConversation.length - 1; i >= 0; i--) {
            if (this.masterConversation[i].role === "assistant") {
                lastCharacter = this.getCharacterByName(this.masterConversation[i].character);
                break;
            }
        }

        if (!lastCharacter) return;

        fetch('/comfy/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ character: lastCharacter, story: this.masterConversation, width:width, height}),
        })
        .then(response => response.json())
        .then(data => {
            if (data.files.length > 0) {
                const url = `/cache/${data.files[0]}`;
                console.log('Image Prompt:', data.character);
                this.addGeneratedImage(url);
                statusIndicator.className = 'generation-status success';
            }
        }).catch(error => {
            statusIndicator.className = 'generation-status error';
        });
    }

    /**
     * Carousel Functions
     */

    /**
     * Add click listeners to generated images
     */
    addImageClickListeners() {
        const imageElements = document.querySelectorAll('#generatedImages img');
        imageElements.forEach((img, index) => {
            img.onclick = () => this.openImageCarousel(index);
        });
    }

    /**
     * Open image carousel
     * @param {number} index - Image index
     */
    openImageCarousel(index) {
        this.currentImageIndex = index;
        const modal = document.getElementById('imageCarouselModal');
        const carouselImage = document.getElementById('carouselImage');
        modal.style.display = 'flex';
        carouselImage.src = this.images[this.currentImageIndex];
    }

    /**
     * Close image carousel modal
     */
    closeModal() {
        const modal = document.getElementById('imageCarouselModal');
        modal.style.display = 'none';
    }

    /**
     * Show next image in the carousel
     */
    showNextImage() {
        let instance = window.chatInstance;
        instance.currentImageIndex = (instance.currentImageIndex + 1) % instance.images.length;
        const carouselImage = document.getElementById('carouselImage');
        carouselImage.src = instance.images[instance.currentImageIndex];
    }

    /**
     * Show previous image in the carousel
     */
    showPrevImage() {
        let instance = window.chatInstance;
        instance.currentImageIndex = (instance.currentImageIndex - 1 + instance.images.length) % instance.images.length;
        const carouselImage = document.getElementById('carouselImage');
        carouselImage.src = instance.images[instance.currentImageIndex];
    }


    /**
     * Conversation Management Functions
     */

    /**
     * Toggle conversation management window visibility
     */
    toggleConversationWindow() {
        const popup = document.getElementById('conversationManagementPopup');
        const isDisplayed = popup.style.display !== 'none';
        popup.style.display = isDisplayed ? 'none' : 'flex';
        this.updateConversationStats();
    }

    /**
     * Save the current conversation as a JSON file
     */
    saveConversation() {
        const fileName = prompt('Enter the conversation file name:', 'conversation.json');
        if (!fileName) return;

        const data = {
            title: this.title,
            lore: this.lore,
            setting: this.setting,
            conversation: this.masterConversation,
            castFileName: this.currentCast
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    /**
     * Load a conversation from a JSON file
     * @param {File} file - The JSON file containing the conversation data
     */
    loadConversation(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const data = JSON.parse(event.target.result);
            this.title = data.title;
            this.lore = data.lore;
            this.setting = data.setting;
            this.masterConversation = data.conversation;
            this.renderChat();

            const loadCast = confirm('Would you like to load the cast file associated with this conversation?');
            if (loadCast) {
                this.fetchCharacters(data.castFileName);
                this.currentCast = data.castFileName;
            } else {
                alert('Cast file not loaded. Continuing with current cast.');
            }

            this.updateConversationStats();
        };
        reader.readAsText(file);
    }

    /**
     * Update conversation statistics in the UI
     */
    updateConversationStats() {
        document.getElementById('currentCastName').innerText = this.currentCast;
        document.getElementById('messageCount').innerText = this.masterConversation.length;

        const uniqueCharacters = [...new Set(this.masterConversation.map(msg => msg.character))];
        document.getElementById('uniqueCharacters').innerText = uniqueCharacters.join(', ');
    }


     /**
     * Toggle the cast editor visibility
     */
     toggleCastEditor() {
        const characterList = document.getElementById('castEditorHolder');
        characterList.classList.toggle('show');
    }

    /**
     * Populate the cast editor with the current cast details
     */
    populateCastEditor() {
        document.getElementById('castFileName').value = this.currentCast;
        document.getElementById('castTitle').value = this.title;
        document.getElementById('castLore').value = this.lore;
        document.getElementById('castSetting').value = this.setting;

        const characterNames = this.characters.map(character => character.name).join(', ');
        document.getElementById('castCharacters').value = characterNames;
    }

    /**
     * Save the modified cast details to the server
     */
    saveCastDetails() {
        const updatedCast = {
            title: document.getElementById('castTitle').value,
            lore: document.getElementById('castLore').value,
            setting: document.getElementById('castSetting').value,
            cast: this.characters
        };

        fetch('/character/save_cast', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                castFileName: this.currentCast,
                castData: updatedCast
            }),
        })
        .then(response => response.json())
        .then(data => {
            console.log('Cast file saved successfully:', data);
            // Optionally show a success message to the user
        })
        .catch(error => {
            console.error('Error saving cast file:', error);
            // Optionally show an error message to the user
        });
    }
}
