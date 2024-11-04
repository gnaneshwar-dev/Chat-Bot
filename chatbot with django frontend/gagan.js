$(document).ready(function() {
    let userId = '';
    $('#userInput, #sendBtn').prop('hidden', true);
    $('#confirmSchedule').prop('disabled', true);
    const now = new Date();
    const minDate = now.toISOString().slice(0, 16); 
    $('#scheduleDate').attr('min', minDate);
    $('#scheduleDate').on('input', function() {
        if ($(this).val()) {
            $('#confirmSchedule').prop('disabled', false);
        } else {
            $('#confirmSchedule').prop('disabled', true);
        }
    });

    $('#startConversation').click(function() {
        $('#userInput, #sendBtn').prop('hidden', false);
        const chatBox = $('#chatBox');
        const welcomeMessage = $('<div></div>').addClass('message bot-message').text('Welcome! How can I assist you today? May I know your name?');
        chatBox.append(welcomeMessage);
        chatBox.scrollTop(chatBox[0].scrollHeight);
        $(this).hide();
    });

    $('#sendBtn').click(function() {
        sendMessage();
    });

    $('#userInput').keypress(function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });


    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    const csrftoken = getCookie('csrftoken');

    function sendMessage() {
        const userInput = $('#userInput').val().trim();
        if (userInput === '') return;

        const chatBox = $('#chatBox');
        const userMessage = $('<div></div>').addClass('message user-message').text(userInput);
        chatBox.append(userMessage);
        $('#userInput').val('');
        chatBox.scrollTop(chatBox[0].scrollHeight);

        $.ajax({
            url: 'http://127.0.0.1:8000/get_data/get_answer/',
           // url: 'http://10.0.0.213:5000/get_answer', 
            type: 'POST',
            dataType: 'json',
            data: JSON.stringify({user_id: userId || "", question: userInput }),
            contentType: 'application/json',
            success: function(response) {
                handleBotResponse(response);
                if (response.user_id) {
                    userId = response.user_id; // Store user ID
                }
            },
            error: function() {
                const errorMessage = $('<div></div>').addClass('message bot-message').text('Sorry, something went wrong.');
                chatBox.append(errorMessage);
                chatBox.scrollTop(chatBox[0].scrollHeight);
            }
        });
    }

    function handleBotResponse(response) {
        const chatBox = $('#chatBox');
        const botMessage = $('<div></div>').addClass('message bot-message').text(response.response);
        chatBox.append(botMessage);
        chatBox.scrollTop(chatBox[0].scrollHeight);

        if (response.exit === 'exit') {
            endChat();
            return;
        }

        $('.pill-options, .checkbox-container').remove();

        if (response.options) {
            const optionsArray = response.options.split(',').map(option => option.trim());
            const pillContainer = $('<div></div>').addClass('pill-options');
            $('.chat-input-container').addClass('hidden');
            
            optionsArray.forEach(option => {
                const pill = $('<div></div>').addClass('pill btn btn-outline-primary m-1').text(option);
                pill.click(function() {
                    if (option === 'Schedule Demo') {
                        $('#schedulePicker').show();
                        $('.pill-options').hide();
                    } else if (option === 'Talk to an Expert') {
                      //  alert('Connect option selected!');
                      $('.pill-options').hide();
                      handleOptionClick(option);
                      
                    } else {
                        handleOptionClick(option);
                    }
                });
                pillContainer.append(pill);
            });
            chatBox.append(pillContainer);
        }

        if (response.dropdownOptions) {
            const checkboxContainer = $('<div></div>').addClass('checkbox-container');
            const optionsArray = response.dropdownOptions;

            $('.chat-input-container').addClass('hidden');
            optionsArray.forEach(option => {
                const checkboxLabel = $('<label class="d-block"></label>');
                const checkbox = $('<input type="checkbox" class="mr-2">').val(option);
                checkboxLabel.append(checkbox).append(option);
                checkboxContainer.append(checkboxLabel);
            });

            const submitButton = $('<button class="btn btn-primary mt-2">Submit</button>');
            checkboxContainer.append(submitButton);
            chatBox.append(checkboxContainer);

            submitButton.click(function() {
                const selectedOptions = Array.from(checkboxContainer.find('input:checked')).map(checkbox => $(checkbox).val()).join(', ');
                handleOptionSubmit(selectedOptions);
            });
        }    
    }

    $('#confirmSchedule').click(function() {
        const selectedDate = $('#scheduleDate').val();
        if (selectedDate) {
            const chatBox = $('#chatBox');
            const userMessage = $('<div></div>').addClass('message user-message').text(`Scheduled for: ${selectedDate}`);
            chatBox.append(userMessage);
            $('#schedulePicker').hide();
            $('.pill-options').hide();
            $.ajax({
               // url: 'http://10.0.0.213:5000/get_answer', 
               url: 'http://127.0.0.1:8000/get_data/get_answer/',
                type: 'POST',
                dataType: 'json',
                data: JSON.stringify({ user_id: userId , question: `schedule ${selectedDate}` }),
                contentType: 'application/json',
                success: function(response) {
                    handleBotResponse(response);
                },
                error: function() {
                    const errorMessage = $('<div></div>').addClass('message bot-message').text('Sorry, something went wrong.');
                    chatBox.append(errorMessage);
                    chatBox.scrollTop(chatBox[0].scrollHeight);
                }
            });
        } else {
            alert('Please select a date and time.');
        }
    });

    $('#cancelSchedule').click(function() {
        $('#schedulePicker').hide();
        $('#scheduleDate').val('');
        $('.pill-options').show();
    });

    function handleOptionClick(option) {
        const chatBox = $('#chatBox');
        const userMessage = $('<div></div>').addClass('message user-message').text(option);
        chatBox.append(userMessage);
        chatBox.scrollTop(chatBox[0].scrollHeight);
        $('.chat-input-container').removeClass('hidden');
        $.ajax({
          //  url: 'http://10.0.0.213:5000/get_answer', 
            url: 'http://127.0.0.1:8000/get_data/get_answer/',
            type: 'POST',
            dataType: 'json',
            data: JSON.stringify({ user_id: userId , question: option }),
            contentType: 'application/json',
            success: function(response) {
                handleBotResponse(response);
            },
            error: function() {
                const errorMessage = $('<div></div>').addClass('message bot-message').text('Sorry, something went wrong.');
                chatBox.append(errorMessage);
                chatBox.scrollTop(chatBox[0].scrollHeight);
            }
        });
    }

    function handleOptionSubmit(selectedOptions) {
        const chatBox = $('#chatBox');
        const userMessage = $('<div></div>').addClass('message user-message').text(selectedOptions);
        chatBox.append(userMessage);
        chatBox.scrollTop(chatBox[0].scrollHeight);
        $('.chat-input-container').removeClass('hidden');
        $.ajax({
            //url: 'http://10.0.0.213:5000/get_answer', 
           url: 'http://127.0.0.1:8000/get_data/get_answer/',
            type: 'POST',
            dataType: 'json',
            data: JSON.stringify({ user_id:userId , question: selectedOptions }),
            contentType: 'application/json',
            success: function(response) {
                handleBotResponse(response);
            },
            error: function() {
                const errorMessage = $('<div></div>').addClass('message bot-message').text('Sorry, something went wrong.');
                chatBox.append(errorMessage);
                chatBox.scrollTop(chatBox[0].scrollHeight);
            }
        });
    }

    function endChat() {
        const chatBox = $('#chatBox');
        const endMessage = $('<div></div>').addClass('message bot-message').text('The chat has ended. Thank you!');
        chatBox.append(endMessage);
        $('.chat-input-container').addClass('hidden');
      //  $('#userInput, #sendBtn').prop('hidden', true);
        const restartButton = $('<button></button>').addClass('btn btn-success mt-3').text('Restart Conversation');
        chatBox.append(restartButton);
        restartButton.click(function() {
           // chatBox.empty(); 
       //     $('#userInput, #sendBtn').prop('hidden', false); 
           // $(this).remove();  
            $('#startConversation').trigger('click');  
          //  const welcomeMessage = $('<div></div>').addClass('message bot-message').text('Welcome! How can I assist you today? May I know your name?');
           // chatBox.append(welcomeMessage);
            $('#scheduleDate').val('');
            $('.chat-input-container').removeClass('hidden');
            const currentUserId = userId
            $.ajax({
                url: 'http://127.0.0.1:8000/get_data/get_answer/', 
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ restart: true }),
                success: function(response) {
                    handleBotResponse(response);
                    console.log('Response from backend:', response); 
                },
                error: function(error) {
                    console.error('Error sending data to backend:', error);
                }
            });
        });

        chatBox.scrollTop(chatBox[0].scrollHeight);
    }

    function updateServerStatus() {
        $.ajax({
            url: 'http://127.0.0.1:8000/monitor/health-check/', 
            method: 'GET',
            success: function(response) {
                if (response.status === "running") {
                    $('#status-indicator').css('background-color', 'green');
                } else {
                    $('#status-indicator').css('background-color', 'red');
                }
            },
            error: function() {
                $('#status-indicator').css('background-color', 'red');
            }
        });
    }

    // Check the server status every 5 seconds
    setInterval(updateServerStatus, 5000);

    // Initial check
    updateServerStatus();
    
});


