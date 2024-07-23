document.addEventListener('DOMContentLoaded', function () {
    window.chatInstance = new Chat();

    // Event Listeners
    document.getElementById('sendButton').addEventListener('click', () => window.chatInstance.sendMessage());
    document.getElementById('characterListToggle').addEventListener('click', () => window.chatInstance.toggleCharacterList());
    document.getElementById('message').addEventListener('input', () => {
        window.chatInstance.handleSendButtonText();
        window.chatInstance.autoGrowTextArea();
    });
    document.getElementById('username_icon').addEventListener('click', () => window.chatInstance.handleUsernameSave());
    document.querySelector('.shortcut-menu').addEventListener('click', () => {
        window.chatInstance.toggleShortcutMenu();
    });
    document.getElementById('uploadCastButton').addEventListener('click', () => {
        window.chatInstance.handleCastUploadForm();
    });
    document.getElementById('loadCastButton').addEventListener('click', () => {
        window.chatInstance.loadCast();
    });

    // Save and Load Conversation
    document.getElementById('saveConversationButton').addEventListener('click', () => {
        window.chatInstance.saveConversation();
    });
    // document.getElementById('loadConversationInput').addEventListener('change', (event) => {
    //     const file = event.target.files[0];
    //     if (file) {
    //         window.chatInstance.loadConversation(file);
    //     }
    // });

    const loadConversationInput = document.getElementById('loadConversationInput');
    const uploadConversationButton = document.getElementById('uploadConversationButton');
    uploadConversationButton.disabled = true; //initially disable the button

    loadConversationInput.addEventListener('change', (event) => {
        if (event.target.files.length > 0) {
            uploadConversationButton.disabled = false;
        } else {
            uploadConversationButton.disabled = true;
        }
    });

    uploadConversationButton.addEventListener('click', () => {
        const file = loadConversationInput.files[0];
        if (file) {
            window.chatInstance.loadConversation(file);
            loadConversationInput.value = ''; // Clear the file input
            uploadConversationButton.disabled = true; // Disable the button again
        }
    });


    // Cast Editor Event Listeners
    document.getElementById('editCastButton').addEventListener('click', () => {
        window.chatInstance.toggleCastEditor();
        window.chatInstance.populateCastEditor();
    });
    document.getElementById('saveCastButton').addEventListener('click', () => {
        window.chatInstance.saveCastDetails();
    });


    // Update statistics when conversation changes
    window.chatInstance.updateConversationStats();

    // Carousel Event Listeners
    document.querySelector('.close').onclick = window.chatInstance.closeModal;
    document.querySelector('.carousel-next').onclick = window.chatInstance.showNextImage;
    document.querySelector('.carousel-prev').onclick = window.chatInstance.showPrevImage;
    
    window.onclick = (event) => {
        const modal = document.getElementById('imageCarouselModal');
        if (event.target === modal) {
            window.chatInstance.closeModal();
        }
    };


    //image generation
    document.getElementById('generateImageButton').addEventListener('click', () => {
        const width = document.getElementById('imageWidth').value;
        const height = document.getElementById('imageHeight').value;
        window.chatInstance.generateCharacterImage(width, height);
    });
});
