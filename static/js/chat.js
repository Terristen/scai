class Chat {
    constructor() {
        this.chatTemplate = Handlebars.compile(document.getElementById('chat-template').innerHTML);
        this.characterTemplate = Handlebars.compile(document.getElementById('character-template').innerHTML);

        this.master_conversation = [];
        this.characters = [];
        this.currentCast = 'characters.json';
        //this.cast_photo_base_url = window.cast_photo_base_url;

        Handlebars.registerHelper('displayName', function (role, username, character) {
            return role === 'user' ? username : character;
        });

        Handlebars.registerHelper('iconRender', function (icon) {
            return window.cast_photo_base_url + (icon === '' ? 'default.jpg' : icon);
        });


        Handlebars.registerHelper('markdown', function(text) {
            return new Handlebars.SafeString(marked.parse(text));
        });

        // Initial Fetches
        this.renderChat();
        this.fetchCharacters();
    }

    /// forces a rerender of the chat window with the current conversation
    renderChat(messages=[]) {
        if(messages.length == 0) {
            messages = this.master_conversation;
        } 
        const username = document.getElementById('username').value || 'User';
        const chatArea = document.getElementById('chatArea');
        chatArea.innerHTML = this.chatTemplate({ messages: messages, username: username });
        chatArea.scrollTop = chatArea.scrollHeight;
        
        if(hljs != undefined) {
            hljs.highlightAll();
        }
    }

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

    /// Gets the list of characters for a given cast file name. Defaults to characters.json
    fetchCharacters(cast="characters.json") {
        const url = new URL('/character/get_characters', window.location.origin);
        if (cast) {
            // Encode the cast parameter to ensure it's URL-safe
            const encodedCast = encodeURIComponent(cast);
            url.searchParams.append('cast', encodedCast);
        }
        fetch(url, { 
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        })
            .then(response => response.json())
            .then(data => {
                this.characters = data.map(character => ({
                    ...character,
                    selected: false,
                    personalitySnippet: character.personality.substring(0, 20) + '...'
                }));
                this.renderCharacters();
            });
    }

    /// saves the current message into the conversation and prompts the server for an AI response. Name is a little confusing because the server doesn't care or keep track of the message list; leftover from previous implementation
    sendMessage(forcePass=false) {
        const message = document.getElementById('message').value;
        const username = document.getElementById('username').value || 'User';
        //const respondents = this.characters.filter(character => character.selected).map(character => character.name);
        const respondents = this.characters.filter(character => character.selected);
        const newMsg = {"role": "user", "content": message, "character": username};
        

        if(!forcePass){
            if (message.trim() !== '') {
                this.master_conversation.push(newMsg);
                this.renderChat();
                document.getElementById('message').value = '';
                this.autoGrowTextArea();
            }
        }

        return fetch('/chat/get_character_message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                respondents: respondents,
                conversation: this.master_conversation
            }),
        })
        .then(response => response.json())
        .then((data) => {
            console.log(data);
            this.master_conversation.push(data.assistant_message);
            this.renderChat();
            let answeringCharacter = this.characters.find(character => character.name === data.assistant_message.character);
            if (answeringCharacter) {
                this.addPortraitImage(window.cast_photo_base_url + answeringCharacter.icon);
            }
        });
        
    }

    toggleCharacterList_orig() {
        const characterList = document.getElementById('characterListHolder');
        if (characterList.classList.contains('show')) {
            characterList.classList.remove('show');
            document.querySelector('.main-container').style.width = 'calc(100% - 60px)';
        } else {
            characterList.classList.add('show');
            document.querySelector('.main-container').style.width = 'calc(100% - 310px)';
        }
    }

    toggleCharacterList() {
        const characterList = document.getElementById('characterListHolder');
        if (characterList.classList.contains('show')) {
            characterList.classList.remove('show');
            //document.querySelector('.main-container').style.width = 'calc(100% - 60px)';
        } else {
            characterList.classList.add('show');
            //document.querySelector('.main-container').style.width = 'calc(100% - 310px)';
        }
    }
    

    /// Force the last message to be regenerated and re-render the chat
    regenerateLastMessage() {
        this.master_conversation.pop();
        this.sendMessage(true);
    }

    deleteLastMessage() {
        this.master_conversation.pop();
        this.renderChat();
    }

    /// Replace the last message with the current value of the message input but don't change the character
    replaceLastMessage() {
        const replacement_message = document.getElementById('message').value;
        
        document.getElementById('message').value = '';
        this.autoGrowTextArea();

        this.master_conversation[this.master_conversation.length - 1].content = replacement_message;
        this.renderChat();
    }

    /// changes the text of the send button to tell user if they are sending a message or passing their turn
    handleSendButtonText() {
        const sendButton = document.getElementById('sendButton');
        const messageInput = document.getElementById('message');
        sendButton.textContent = messageInput.value.trim() ? 'Send' : 'Pass';
    }

    /// Save the username to the server
    handleUsernameSave() {
        const username = document.getElementById('username').value;
        fetch('/character/save_username', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username
            }),
        })
        .then(response => response.json());   
    }

    /// Copy the last message to the input box. Usually used in conjunction with replaceLastMessage to edit the last message
    copyLastMessageToInput() {
        const lastMessage = this.master_conversation[this.master_conversation.length - 1].content;
        document.getElementById('message').value = lastMessage;
        this.autoGrowTextArea();
    }

    /// Automatically adjust the height of the textarea based on the content
    autoGrowTextArea_orig() {
        let messageElement = document.getElementById('message');
        // Reset height to ensure we're not restricted by previous height
        messageElement.style.height = 'auto';
        if (messageElement.value.trim() === '') {
            // If textarea is empty, reset to default height (e.g., 20px or the original height)
            //messageElement.style.height = '20px'; // Adjust this value to match your design's initial height
            messageElement.rows = 1;
        } else {
            // Set height based on scroll height, but not more than max-height
            messageElement.style.height = Math.min(messageElement.scrollHeight, 200) + 'px'; // 200px is the max-height
        }
    }

    autoGrowTextArea() {
        let messageElement = document.getElementById('message');
        messageElement.style.height = 'auto';
        messageElement.style.height = Math.min(messageElement.scrollHeight, 200) + 'px';
    }

    /// Toggle the hamburger menu visibility
    toggleHamburgerMenu() {
        var menuContent = document.querySelector('.hamburger-menu-content');
        if (menuContent.style.display === 'none') {
            menuContent.style.display = 'block';
        } else {
            menuContent.style.display = 'none';
        }
    }

    ///function to pull the list of character casts from the server via characters/get_cast_list: returns a list of filename.extention
    async getCastList() {
        const response = await fetch('/character/get_cast_list', {
            method: 'GET'
        });
        const data = await response.json();
        return data;
    }
    
    ///function to populate the castSelector dropdown with the list of character casts
    async populateCastSelector() {
        const castSelector = document.getElementById('castSelector');
        // Clear the castSelector
        castSelector.innerHTML = '';
    
        const casts = await this.getCastList(); // Wait for the getCastList function to complete
        
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

    ///WIP
    async load_cast(filename = '') {
        if (filename === '') {
            const castSelector = document.getElementById('castSelector');
            filename = castSelector.value;
        }
        
        this.currentCast = filename;
        
        this.fetchCharacters(this.currentCast);
    }

    ///WIP
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
                await this.load_cast(filename); // Wait for load_cast to complete
                await this.populateCastSelector(); // Wait for populateCastSelector to complete if it's async
            } catch (error) {
                console.error('Error:', error);
            }
        }
    }

    toggleCastWindow(){
        const popup = document.getElementById('castManagementPopup');
        const isDisplayed = castManagementPopup.style.display !== 'none';
        popup.style.display = isDisplayed ? 'none' : 'flex';
        if (!isDisplayed) {
            this.populateCastSelector();
        }
    }

    getCharacterByName(name) {
        return this.characters.find(character => character.name === name);
    }

    

    /*
     * Image Strip Functions
     */

    toggleImageStrip() {
        document.getElementById('imageStrip').classList.toggle('show');
    }

    addPortraitImage(imageUrl) {
        document.getElementById('portraitContainer').innerHTML = `<img src="${imageUrl}" alt="Portrait">`;
    }

    addGeneratedImage(imageUrl) {
        const tpl = Handlebars.compile(document.getElementById('image-template').innerHTML);
        const newImage = tpl({ url: imageUrl });
        const cont = document.getElementById('generatedImages');
        cont.innerHTML += newImage;
        cont.scrollTop = cont.scrollHeight;
    }


    /*
     * Image Generation Functions
     */
    generateCharacterImage() {
        console.log("Generating Character Image");
        let lastCharacter = null;

        for(let m = this.master_conversation.length - 1; m >= 0; m--) {
            if(this.master_conversation[m].role == "assistant") {
                lastCharacter = this.getCharacterByName(this.master_conversation[m].character);
                break;
            }
        }
        
        if(lastCharacter == null) {
            return;
        }

        fetch('/comfy/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                character: lastCharacter
            }),
        })
        .then(response => response.json())
        .then((data) => {
            
            if(data.length > 0) {
                var url = "/cache/" + data[0];
                this.addGeneratedImage(url);
            }
        });
    }

}
