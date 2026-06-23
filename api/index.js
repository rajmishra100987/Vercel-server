// api/index.js - Vercel Serverless Function
const https = require('https');
const fs = require('fs');
const path = require('path');

// ANSI colors
const colors = {
  green: '\x1b[92m',
  red: '\x1b[91m',
  reset: '\x1b[0m'
};

// Headers
const headers = {
  'Connection': 'keep-alive',
  'Cache-Control': 'max-age=0',
  'Upgrade-Insecure-Requests': '1',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 8.0.0; Samsung Galaxy S9 Build/OPR6.170623.017; wv) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.125 Mobile Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
  'Accept-Encoding': 'gzip, deflate',
  'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
  'referer': 'www.google.com'
};

// Read file function
function readFileContent(filename) {
  try {
    const filePath = path.join('/tmp', filename);
    // For Vercel, files need to be in /tmp or public
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`Error reading ${filename}:`, err.message);
    return null;
  }
}

function readFileLines(filename) {
  try {
    const content = readFileContent(filename);
    if (!content) return [];
    return content.split('\n').filter(line => line.trim() !== '');
  } catch (err) {
    return [];
  }
}

// Send POST request
function sendPostRequest(url, parameters, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(parameters);

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true, status: res.statusCode, data });
        } else {
          resolve({ ok: false, status: res.statusCode, data });
        }
      });
    });

    req.on('error', (error) => { reject(error); });
    req.write(postData);
    req.end();
  });
}

function liness() {
  console.log('\x1b[92m' + '•─────────────────────────────────────────────────────────•' + '\x1b[0m');
}

// Main function - Vercel handler
module.exports = async (req, res) => {
  try {
    // Read files from /tmp (Vercel allows writing to /tmp)
    const convoId = readFileContent('convo.txt')?.trim() || '';
    const messages = readFileLines('File.txt');
    const tokens = readFileLines('tokennum.txt');
    const hatersName = readFileContent('hatersname.txt')?.trim() || '';
    const speed = parseInt(readFileContent('time.txt')?.trim() || '5');

    if (!convoId || messages.length === 0 || tokens.length === 0) {
      return res.status(400).json({ 
        error: 'Missing files. Make sure convo.txt, File.txt, tokennum.txt exist in /tmp' 
      });
    }

    const numMessages = messages.length;
    const numTokens = tokens.length;
    const maxTokens = Math.min(numTokens, numMessages);

    let successCount = 0;
    let failCount = 0;

    // Send only 1 message per request (Vercel timeout limit)
    const messageIndex = Math.floor(Math.random() * numMessages);
    const tokenIndex = messageIndex % maxTokens;
    const accessToken = tokens[tokenIndex].trim();
    const message = messages[messageIndex].trim();

    const url = `https://graph.facebook.com/v17.0/t_${convoId}/`;
    const parameters = {
      access_token: accessToken,
      message: `${hatersName} ${message}`
    };

    try {
      const response = await sendPostRequest(url, parameters, headers);
      
      if (response.ok) {
        successCount++;
        console.log(`\x1b[92m[+] Sent: ${hatersName} ${message}\x1b[0m`);
      } else {
        failCount++;
        console.log(`\x1b[91m[x] Failed: ${hatersName} ${message}\x1b[0m`);
      }
    } catch (error) {
      failCount++;
      console.log(`[!] Error: ${error.message}`);
    }

    return res.status(200).json({
      status: 'OK',
      success: successCount,
      failed: failCount,
      message: `Sent ${successCount} messages, ${failCount} failed`
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
};
