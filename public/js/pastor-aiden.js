document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('pastor-form');
    const responseContainer = document.getElementById('response-container');
    const responseContent = document.getElementById('response-content');
    const loading = document.getElementById('loading');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const question = document.getElementById('question').value.trim();

        if (!question) {
            alert('Please enter a question.');
            return;
        }

        // Show loading, hide response
        loading.classList.remove('hidden');
        responseContainer.classList.add('hidden');

        try {
            const response = await fetch('/api/ask-pastor', {  // Added /api/ prefix
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to get response');
            }

            // Format the response with proper line breaks and paragraph spacing
            let formattedResponse = data.response
                .replace(/\n\n/g, '</p><p class="mb-4">')
                .replace(/\n/g, '<br>');
            
            // Wrap in paragraph tags if not already
            if (!formattedResponse.startsWith('<p')) {
                formattedResponse = '<p class="mb-4">' + formattedResponse + '</p>';
            }

            // Display the response
            responseContent.innerHTML = formattedResponse;
            responseContainer.classList.remove('hidden');

            // Scroll to response
            responseContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

        } catch (error) {
            console.error('Error:', error);
            responseContent.innerHTML = '<p class="text-red-600 text-lg">An error occurred. Please try again later.</p>';
            responseContainer.classList.remove('hidden');
        } finally {
            loading.classList.add('hidden');
        }
    });
});