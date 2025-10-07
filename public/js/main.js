// public/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    const devotionalContent = document.getElementById('devotional-content');
    if (!devotionalContent) return;

    // Create a new showdown converter
    const converter = new showdown.Converter();

    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    const devotionalUrl = `/devotionals/${dateString}.md`;

    // Fetch the devotional file for today
    fetch(devotionalUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Devotional for today not found.');
            }
            return response.text();
        })
        .then(markdown => {
            // Convert markdown to HTML and display it
            const html = converter.makeHtml(markdown);
            devotionalContent.innerHTML = html;
        })
        .catch(error => {
            console.error(error);
            devotionalContent.innerHTML = `
                <h2 class="text-2xl font-bold text-gray-800 mb-4">Welcome</h2>
                <p class="text-gray-600">A new devotional for today is coming soon. Please check back later.</p>
            `;
        });
});