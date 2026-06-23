const https = require('https');
const fs = require('fs');
const path = require('path');

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

// Read file function - Root level se
function readFileLines(filename) {
  try {
    const filePath = path.join(__dirname, '..', filename);
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').filter(line => line.trim() !== '');
  } catch (err) {
    console.error(`Error reading ${filename}:`, err.message);
    return [];
  }
}

// Send POST request to Facebook
function sendPostRequest(url, parameters) {
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

// Main Vercel function
module.exports = async (req, res) => {
  try {
    // Read all files from root
    const convoId = readFileLines('convo.txt')[0] || '';
    const messages = readFileLines('File.txt');
    const tokens = readFileLines('tokennum.txt');
    const hatersName = readFileLines('hatersname.txt')[0] || '';
    const speed = parseInt(readFileLines('time.txt')[0] || '5');

    // Check if files exist
    if (!convoId) {
      return res.status(400).json({ error: 'convo.txt missing or empty' });
    }
    if (messages.length === 0) {
      return res.status(400).json({ error: 'File.txt missing or empty' });
    }
    if (tokens.length === 0) {
      return res.status(400).json({ error: 'tokennum.txt missing or empty' });
    }

    // Counter file for tracking (Vercel /tmp directory)
    const counterPath = '/tmp/counter.txt';
    let counter = 0;
    try {
      counter = parseInt(fs.readFileSync(counterPath, 'utf8')) || 0;
    } catch (e) {
      counter = 0;
    }

    // Send 1 message per request (to avoid timeout)
    const messageIndex = counter % messages.length;
    const tokenIndex = messageIndex % tokens.length;
    
    const accessToken = tokens[tokenIndex].trim();
    const message = messages[messageIndex].trim();

    const url = `https://graph.facebook.com/v17.0/t_${convoId}/`;
    const parameters = {
      access_token: accessToken,
      message: `${hatersName} ${message}`
    };

    // Send message
    const response = await sendPostRequest(url, parameters);
    
    // Update counter
    counter++;
    fs.writeFileSync(counterPath, counter.toString());

    if (response.ok) {
      console.log(`✅ Message ${counter}: ${hatersName} ${message} (Token ${tokenIndex + 1})`);
      return res.status(200).json({
        status: 'OK',
        message: `Sent: ${hatersName} ${message}`,
        token: tokenIndex + 1,
        totalSent: counter
      });
    } else {
      console.log(`❌ Failed: ${hatersName} ${message}`);
      return res.status(200).json({
        status: 'Failed',
        message: `Failed: ${hatersName} ${message}`,
        token: tokenIndex + 1,
        totalSent: counter
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
