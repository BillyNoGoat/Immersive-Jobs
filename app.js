const axios = require('axios');
const jsdom = require('jsdom');
const _ = require('lodash');
const config = require('./config.json');
const fs = require('fs');

const oldJobs = require('./oldData.json');

// Scrape the jobs page, returns all job data for today
async function getTodayJobs() {
    const res = await axios.get(config.CAREERS_URL);
    const dom = new jsdom.JSDOM(res.data);
    // Grab a JSON list of all available jobs
    const todayJobs = Array.from(dom.window.document.querySelectorAll(".job")).map(job => {
        const listing = {
            "title": job.querySelector(".title h4 a").innerHTML,
            "location": job.querySelector(".meta h6").innerHTML
        };
        return listing;
    });
    return todayJobs;
}

// Takes today's jobs and compares them with the previously saved day's jobs to determine new jobs
async function getNewJobs(todayJobs){
    return todayJobs.filter((newJob) => {
        return !oldJobs.some(oldJob => _.isEqual(oldJob, newJob))
    });
}

async function sendDiscordNotification(newJobs) {
    const messages = newJobs.map(job => {
        return {
            "author": {
                "name": "New Immersive Labs Job"
            },
            "title": job.title,
            "description": job.location,
            "url": config.CAREERS_URL,
            "thumbnail": {
                "url": config.LOGO_URL
            },
            "timestamp": new Date().toISOString(),
        }
    });

    for (message of messages) {
        await axios({
            method: "POST",
            url: config.WEBHOOK_URL,
            headers: {
                "Content-Type": "application/json"
            },
            data: {
                "content": null,
                "embeds": [message]
            }
        });
        // Hacky Discord webhook rate limiting protection
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}

// Overwrite previous day's values
async function overwriteLocal(data){
    fs.writeFileSync(config.DB_FILE ,JSON.stringify(data, null, 2));
};

(async () => {
    const todayJobs = await getTodayJobs();
    const newJobs = await getNewJobs(todayJobs);
    console.log(`[${new Date().toUTCString()}] Found ${todayJobs.length} jobs. ${newJobs.length} are new since last run.`);
    if(newJobs.length){
        sendDiscordNotification(newJobs);
        overwriteLocal(todayJobs);
    }
})();