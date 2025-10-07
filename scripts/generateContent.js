const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const fs = require("fs/promises");
const path = require("path");

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const DAYS_TO_GENERATE = 7; 
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'devotionals');

function getPrompt(verseText, verseReference) {
    return `You are an AI assistant creating content for a Baptist resource website. Your theology must strictly align with Southern Baptist and Independent Baptist beliefs. Here is the scripture for today from the King James Version: "${verseText}" (${verseReference}).

Write a 400-word devotional based on this specific verse. The output must be in simple Markdown format. It should include a title using a heading (e.g., # A Reflection on ${verseReference}), the devotional text, and a concluding one-sentence prayer.`;
}

async function getRandomVerse() {
    try {
        const chapter = Math.floor(Math.random() * 31) + 1;
        const verseNum = Math.floor(Math.random() * 30) + 1;
        const response = await fetch(`https://bible-api.com/proverbs+${chapter}:${verseNum}?translation=kjv`);
        if (!response.ok) throw new Error(`API call failed with status: ${response.status}`);

        const data = await response.json();
        return { text: data.text.trim(), reference: data.reference };
    } catch (error) {
        console.error("Error fetching Bible verse:", error);
        return { text: "The LORD is my shepherd; I shall not want.", reference: "Psalm 23:1" };
    }
}

async function main() {
    console.log("Starting content generation process...");
    try {
        await fs.mkdir(OUTPUT_DIR, { recursive: true });

        for (let i = 0; i < DAYS_TO_GENERATE; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            const dateString = date.toISOString().split('T')[0];

            console.log(`[${i + 1}/${DAYS_TO_GENERATE}] Generating devotional for ${dateString}...`);

            const { text: verseText, reference: verseReference } = await getRandomVerse();
            const prompt = getPrompt(verseText, verseReference);

            const result = await model.generateContent(prompt);
            const response = await result.response;
            let aiText = response.text();

            const filePath = path.join(OUTPUT_DIR, `${dateString}.md`);
            await fs.writeFile(filePath, aiText);

            console.log(`   -> Successfully saved to ${filePath}`);

            await new Promise(resolve => setTimeout(resolve, 1000)); 
        }

        console.log("\n✅ Content generation complete!");
        console.log(`   ${DAYS_TO_GENERATE} devotional files created in public/devotionals.`);

    } catch (error) {
        console.error("An error occurred during content generation:", error);
    }
}

main();
