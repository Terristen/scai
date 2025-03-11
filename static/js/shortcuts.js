document.addEventListener('DOMContentLoaded', function () {
    
    // sendMessage shortcut
    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.key === 'Enter') {
            window.chatInstance.sendMessage();
        }
    });

    // regenerateLastMessage shortcut
    document.addEventListener('keydown', function(event) {
        if (event.altKey && event.key === 'Enter') {
            window.chatInstance.regenerateLastMessage();
        }
    });

    // deleteLastMessage shortcut
    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.shiftKey && event.key === 'Backspace') {
            window.chatInstance.deleteLastMessage();
        }
    });

    // copy last message to user input shortcut
    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.shiftKey && event.key === 'K') {
            window.chatInstance.copyLastMessageToInput();
        }
    });

    // replaceLastMessage shortcut
    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.shiftKey && event.key === 'L') {
            window.chatInstance.replaceLastMessage();
        }
    });

    // toggleCharacterList shortcut
    document.addEventListener('keydown', function(event) {
        if (event.altKey && event.key === '1') {
            event.preventDefault();
            window.chatInstance.toggleCharacterList();
        }
    });

    // toggleCastWindow shortcut
    // document.addEventListener('keydown', function(event) {
    //     if (event.altKey && event.key === '3') {
    //         event.preventDefault();
    //         window.chatInstance.toggleCastWindow();
    //     }
    // });

    // toggleConversationWindow shortcut
    document.addEventListener('keydown', function(event) {
        if (event.altKey && event.key === '3') {
            event.preventDefault();
            window.chatInstance.toggleConversationWindow();
        }
    });

    // toggleImageStrip shortcut
    document.addEventListener('keydown', function(event) {
        if (event.altKey && event.key === '2') {
            event.preventDefault();
            window.chatInstance.toggleImageStrip();
        }
    });

    // generateCharacterImage shortcut
    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.key === 'I') {
            event.preventDefault();
            window.chatInstance.generateCharacterImage();
        }
    });

});
