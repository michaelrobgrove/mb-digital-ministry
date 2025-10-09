document.addEventListener('DOMContentLoaded', function() {
    // Keep existing functionality
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // --- New Newsletter Subscription Form Logic ---
    function injectNewsletterForm() {
        const footer = document.querySelector('footer');
        if (!footer) {
            console.error('Footer element not found. Cannot inject newsletter form.');
            return;
        }

        const formHTML = `
            <div class="mt-8 border-t border-gray-700 pt-8">
                <h3 class="text-lg font-semibold text-white">Subscribe to our Newsletter</h3>
                <p class="text-gray-400 mt-2">Get the latest sermons, devotionals, and prayer requests delivered to your inbox.</p>
                <form id="newsletter-form" class="mt-4">
                    <div class="flex flex-col sm:flex-row gap-4">
                        <input type="email" id="newsletter-email" name="email" placeholder="Enter your email" required class="w-full px-4 py-2 text-gray-900 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <button type="submit" id="newsletter-submit" class="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
                            Subscribe
                        </button>
                    </div>
                     <div class="mt-4 space-y-2">
                        <div class="flex items-center">
                            <input type="checkbox" id="newsletter-weekly" name="weekly" value="true" checked class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500">
                            <label for="newsletter-weekly" class="ml-2 text-sm text-gray-300">Weekly Sermon & Prayer (Sun & Wed)</label>
                        </div>
                        <div class="flex items-center">
                            <input type="checkbox" id="newsletter-daily" name="daily" value="true" checked class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500">
                            <label for="newsletter-daily" class="ml-2 text-sm text-gray-300">Daily Devotional</label>
                        </div>
                         <div class="flex items-center pt-2">
                            <input type="checkbox" id="newsletter-consent" name="consent" required class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500">
                            <label for="newsletter-consent" class="ml-2 text-sm text-gray-300">I agree to be contacted via email.</label>
                        </div>
                    </div>
                    <!-- Honeypot field for spam prevention -->
                    <div style="position: absolute; left: -5000px;" aria-hidden="true">
                        <input type="text" id="ministry_solution" name="ministry_solution" tabindex="-1" autocomplete="off">
                    </div>
                </form>
                <div id="newsletter-message" class="mt-4 text-sm"></div>
            </div>
        `;

        footer.innerHTML += formHTML;
        
        const newsletterForm = document.getElementById('newsletter-form');
        const submitButton = document.getElementById('newsletter-submit');
        const messageDiv = document.getElementById('newsletter-message');

        newsletterForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const originalButtonText = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = 'Subscribing...';
            messageDiv.textContent = '';
            messageDiv.className = 'mt-4 text-sm';


            const formData = new FormData(newsletterForm);
            const data = {
                email: formData.get('email'),
                weekly: formData.get('weekly') === 'true',
                daily: formData.get('daily') === 'true',
                consent: formData.has('consent'),
                ministry_solution: formData.get('ministry_solution')
            };

            try {
                const response = await fetch('/api/subscribe', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data),
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    messageDiv.textContent = result.message;
                    messageDiv.classList.add('text-green-400');
                    newsletterForm.reset();
                    // Restore default checked state
                    document.getElementById('newsletter-weekly').checked = true;
                    document.getElementById('newsletter-daily').checked = true;
                } else {
                    messageDiv.textContent = result.message || 'An error occurred.';
                    messageDiv.classList.add('text-red-400');
                }
            } catch (error) {
                console.error('Subscription submission error:', error);
                messageDiv.textContent = 'A network error occurred. Please try again.';
                messageDiv.classList.add('text-red-400');
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText;
            }
        });
    }

    injectNewsletterForm();
});
