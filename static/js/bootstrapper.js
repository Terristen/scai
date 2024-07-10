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
    document.querySelector('.hamburger-menu').addEventListener('click', () => {
        window.chatInstance.toggleHamburgerMenu();
    });
    document.getElementById('uploadCastButton').addEventListener('click', () => {
        window.chatInstance.handleCastUploadForm();
    });
    document.getElementById('loadCastButton').addEventListener('click', () => {
        window.chatInstance.load_cast();
    });

});
