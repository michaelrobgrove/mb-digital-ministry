/**
 * Scheduled Cron Trigger for Sermon Generation
 * Runs automatically based on cron schedule
 */

const sermonThemes = [
        // ... (Your full list of sermonThemes remains here) ...
        // Old Testament - Pentateuch
        { book: "Genesis", passage: "Genesis 1:1-31", theme: "Creation and God's Design" },
        { book: "Genesis", passage: "Genesis 12:1-9", theme: "Abraham's Call and Faith" },
        { book: "Exodus", passage: "Exodus 3:1-15", theme: "The Burning Bush and God's Name" },
        { book: "Exodus", passage: "Exodus 20:1-17", theme: "The Ten Commandments" },
        { book: "Leviticus", passage: "Leviticus 19:1-18", theme: "Holiness and Love for Neighbor" },
        { book: "Numbers", passage: "Numbers 13-14", theme: "Faith vs. Fear in the Promised Land" },
        { book: "Deuteronomy", passage: "Deuteronomy 6:4-9", theme: "The Shema: Loving God Completely" },
        
        // Old Testament - Historical Books
        { book: "Joshua", passage: "Joshua 1:1-9", theme: "Courage and God's Presence" },
        { book: "Judges", passage: "Judges 6-7", theme: "Gideon: When God Calls the Unlikely" },
        { book: "Ruth", passage: "Ruth 1-4", theme: "Loyalty, Redemption, and Providence" },
        { book: "1 Samuel", passage: "1 Samuel 17", theme: "David and Goliath: Faith Over Fear" },
        { book: "2 Samuel", passage: "2 Samuel 7:1-17", theme: "The Davidic Covenant" },
        { book: "Nehemiah", passage: "Nehemiah 1-2", theme: "Prayer and Action in Rebuilding" },
        { book: "Esther", passage: "Esther 4:14", theme: "For Such a Time as This" },
        
        // Old Testament - Wisdom Literature
        { book: "Job", passage: "Job 1-2, 42", theme: "Suffering and God's Sovereignty" },
        { book: "Psalms", passage: "Psalm 1", theme: "The Way of the Righteous" },
        { book: "Psalms", passage: "Psalm 23", theme: "The Lord is My Shepherd" },
        { book: "Psalms", passage: "Psalm 51", theme: "A Heart of Repentance" },
        { book: "Psalms", passage: "Psalm 119:105-112", theme: "The Word as a Lamp" },
        { book: "Proverbs", passage: "Proverbs 3:5-6", theme: "Trusting God's Guidance" },
        { book: "Proverbs", passage: "Proverbs 31:10-31", theme: "The Virtuous Woman" },
        { book: "Ecclesiastes", passage: "Ecclesiastes 12:13-14", theme: "The Whole Duty of Man" },
        
        // Old Testament - Major Prophets
        { book: "Isaiah", passage: "Isaiah 53", theme: "The Suffering Servant" },
        { book: "Isaiah", passage: "Isaiah 6:1-8", theme: "Isaiah's Vision and Calling" },
        { book: "Jeremiah", passage: "Jeremiah 29:11-13", theme: "God's Plans for Hope and Future" },
        { book: "Ezekiel", passage: "Ezekiel 37:1-14", theme: "The Valley of Dry Bones" },
        { book: "Daniel", passage: "Daniel 3", theme: "Faith in the Fiery Furnace" },
        
        // Old Testament - Minor Prophets
        { book: "Jonah", passage: "Jonah 1-4", theme: "Obedience and God's Mercy" },
        { book: "Micah", passage: "Micah 6:8", theme: "What Does the Lord Require?" },
        { book: "Habakkuk", passage: "Habakkuk 3:17-19", theme: "Rejoicing in the Lord Always" },
        { book: "Malachi", passage: "Malachi 3:8-10", theme: "Tithing and God's Blessings" },
        
        // New Testament - Gospels
        { book: "Matthew", passage: "Matthew 5:1-12", theme: "The Beatitudes" },
        { book: "Matthew", passage: "Matthew 28:18-20", theme: "The Great Commission" },
        { book: "Mark", passage: "Mark 10:45", theme: "Jesus Came to Serve" },
        { book: "Luke", passage: "Luke 15:11-32", theme: "The Prodigal Son" },
        { book: "Luke", passage: "Luke 10:25-37", theme: "The Good Samaritan" },
        { book: "Luke", passage: "Luke 19:1-10", theme: "Zacchaeus: Salvation Has Come" },
        { book: "John", passage: "John 1:1-14", theme: "The Word Became Flesh" },
        { book: "John", passage: "John 3:16-21", theme: "God's Love and Eternal Life" },
        { book: "John", passage: "John 14:1-6", theme: "The Way, Truth, and Life" },
        { book: "John", passage: "John 15:1-17", theme: "Abiding in the Vine" },
        
        // New Testament - Acts
        { book: "Acts", passage: "Acts 1:8", theme: "The Power of the Holy Spirit" },
        { book: "Acts", passage: "Acts 2:1-47", theme: "Pentecost and the Birth of the Church" },
        { book: "Acts", passage: "Acts 9:1-19", theme: "Paul's Conversion" },
        
        // New Testament - Paul's Epistles
        { book: "Romans", passage: "Romans 3:23-26", theme: "Justification by Faith" },
        { book: "Romans", passage: "Romans 5:1-11", theme: "Peace with God Through Christ" },
        { book: "Romans", passage: "Romans 8:28-39", theme: "More Than Conquerors" },
        { book: "Romans", passage: "Romans 12:1-2", theme: "Living Sacrifices" },
        { book: "1 Corinthians", passage: "1 Corinthians 13", theme: "The Excellence of Love" },
        { book: "1 Corinthians", passage: "1 Corinthians 15:1-8", theme: "The Gospel and the Resurrection" },
        { book: "2 Corinthians", passage: "2 Corinthians 5:17-21", theme: "New Creation and Reconciliation" },
        { book: "Galatians", passage: "Galatians 5:22-23", theme: "The Fruit of the Spirit" },
        { book: "Ephesians", passage: "Ephesians 2:8-10", theme: "Saved by Grace" },
        { book: "Ephesians", passage: "Ephesians 4:1-16", theme: "Unity in the Body of Christ" },
        { book: "Ephesians", passage: "Ephesians 6:10-18", theme: "The Armor of God" },
        { book: "Philippians", passage: "Philippians 2:1-11", theme: "The Mind of Christ" },
        { book: "Philippians", passage: "Philippians 4:4-13", theme: "Rejoicing and Contentment in Christ" },
        { book: "Colossians", passage: "Colossians 3:1-17", theme: "Setting Our Minds on Things Above" },
        { book: "1 Thessalonians", passage: "1 Thessalonians 4:13-18", theme: "The Rapture and Blessed Hope" },
        { book: "2 Thessalonians", passage: "2 Thessalonians 3:6-13", theme: "Working and Not Being Idle" },
        { book: "1 Timothy", passage: "1 Timothy 3:1-13", theme: "Qualifications for Church Leadership" },
        { book: "2 Timothy", passage: "2 Timothy 2:15", theme: "Rightly Dividing the Word" },
        { book: "2 Timothy", passage: "2 Timothy 3:16-17", theme: "The Inspiration of Scripture" },
        { book: "Titus", passage: "Titus 2:11-14", theme: "The Grace That Brings Salvation" },
        { book: "Philemon", passage: "Philemon 1:8-21", theme: "Forgiveness and Reconciliation" },
        
        // New Testament - General Epistles
        { book: "Hebrews", passage: "Hebrews 11:1-40", theme: "The Hall of Faith" },
        { book: "Hebrews", passage: "Hebrews 12:1-2", theme: "Running the Race with Endurance" },
        { book: "James", passage: "James 1:2-8", theme: "Trials and Wisdom" },
        { book: "James", passage: "James 2:14-26", theme: "Faith and Works" },
        { book: "1 Peter", passage: "1 Peter 2:9-12", theme: "A Chosen People" },
        { book: "1 Peter", passage: "1 Peter 5:6-11", theme: "Casting Your Cares on God" },
        { book: "2 Peter", passage: "2 Peter 1:3-11", theme: "Growing in Godliness" },
        { book: "1 John", passage: "1 John 4:7-21", theme: "God is Love" },
        { book: "1 John", passage: "1 John 1:5-10", theme: "Walking in the Light" },
        { book: "Jude", passage: "Jude 1:20-25", theme: "Building Up Your Faith" },
        
        // New Testament - Revelation
        { book: "Revelation", passage: "Revelation 1:4-8", theme: "The Alpha and Omega" },
        { book: "Revelation", passage: "Revelation 21:1-8", theme: "The New Heaven and New Earth" }
    ];

export async function onRequest(context) {
    const { env } = context;
    
    console.log("Cron-triggered sermon generation starting...");
    
    const selectedTheme = sermonThemes[Math.floor(Math.random() * sermonThemes.length)];
    
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
    const prompt = `You are Pastor AIden, creating a unique weekly expositional sermon for a Baptist resource website. Your theology must strictly align with Southern Baptist and Independent Baptist beliefs, using the King James Version of the Bible for all scripture references.

Generate a complete, original sermon of approximately 1,000-1,200 words based on:
Book: ${selectedTheme.book}
Passage: ${selectedTheme.passage}
Theme: ${selectedTheme.theme}

IMPORTANT REQUIREMENTS:
1. This must be a UNIQUE, ORIGINAL sermon - not generic or repetitive
2. Provide deep verse-by-verse exposition of the specific passage
3. Include historical and cultural context relevant to the passage
4. Give practical, specific applications for modern believers
5. Structure: Introduction, 3-4 main points with sub-points, and a powerful conclusion with a call to action
6. Quote the KJV Scripture extensively throughout
7. Use vivid illustrations and examples relevant to the passage
8. Make this sermon distinctive - avoid generic phrases or cookie-cutter content

Your response MUST be a JSON object with this exact schema:
{
  "topic": "A specific, engaging topic directly related to this passage (e.g., 'Walking by Faith in Impossible Circumstances')",
  "title": "A formal, specific sermon title (e.g., 'Hebrews 11:1-6: The Foundation and Power of Biblical Faith')",
  "text": "The complete sermon text with proper paragraph breaks using \\n\\n"
}`;
    
    try {
        const response = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.9,
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 8192,
                    response_mime_type: "application/json",
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API Error:', errorText);
            return new Response(JSON.stringify({ error: 'API Error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const data = await response.json();
        let sermonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!sermonText) throw new Error('No valid sermon text returned');
        
        sermonText = sermonText.replace(/^```json\n/, '').replace(/\n```$/, '');
        const sermonData = JSON.parse(sermonText);
        
        const sermonId = `sermon:${new Date().toISOString()}`;
        const fullSermonData = {
            id: sermonId,
            title: sermonData.title,
            topic: sermonData.topic,
            text: sermonData.text,
            createdAt: new Date().toISOString(),
            audioData: null
        };
        
        await env.MBSERMON.put(sermonId, JSON.stringify(fullSermonData), {
            expirationTtl: 5616000 // approx 65 days
        });
        
        console.log("Cron sermon generation successful. ID:", sermonId);

        return new Response(JSON.stringify({ 
            success: true, 
            sermonId: sermonId 
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        console.error("Sermon generation failed:", e);
        return new Response(JSON.stringify({ 
            error: e.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
