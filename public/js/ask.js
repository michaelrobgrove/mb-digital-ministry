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
            const response = await fetch('/ask-pastor', {
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

            // Display the response
            responseContent.innerHTML = data.response.replace(/\n/g, '<br>');
            responseContainer.classList.remove('hidden');

        } catch (error) {
            console.error('Error:', error);
            responseContent.innerHTML = '<p class="text-red-600">An error occurred. Please try again later.</p>';
            responseContainer.classList.remove('hidden');
        } finally {
            loading.classList.add('hidden');
        }
    });
});