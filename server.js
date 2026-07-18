const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// In-memory cache for daily rates
let ratesCache = {
  loans: null,
  deposits: null,
  effectiveDateLoans: '',
  effectiveDateDeposits: '',
  lastUpdated: null
};

// Clean HTML tags and entities
function cleanText(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ') // remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    .replace(/\s+/g, ' ') // collapse whitespaces
    .trim();
}

// Robust regex HTML parser for rates tables
function parseRatesHtml(html) {
  const result = [];
  
  // Extract effective date: <div class='rates-effective'>Rates effective as of 7/9/2026</div>
  let effectiveDate = '';
  const effectiveMatch = html.match(/class=['"]rates-effective['"]>([^<]+)</i);
  if (effectiveMatch) {
    effectiveDate = cleanText(effectiveMatch[1]);
  }
  
  // Find all sections. Each starts with <h3 id='...' class='table-rates-title'>Title</h3>
  const sectionRegex = /<h3\s+id=['"]([^'"]+)['"]\s+class=['"]table-rates-title['"]>([\s\S]*?)<\/h3>/gi;
  let match;
  const sections = [];
  
  while ((match = sectionRegex.exec(html)) !== null) {
    sections.push({
      id: match[1],
      title: cleanText(match[2]),
      index: match.index,
      endIndex: match.index + match[0].length
    });
  }
  
  // Parse elements between headers
  for (let i = 0; i < sections.length; i++) {
    const currentSection = sections[i];
    const nextSection = sections[i + 1];
    const chunkStart = currentSection.endIndex;
    const chunkEnd = nextSection ? nextSection.index : html.length;
    const chunk = html.substring(chunkStart, chunkEnd);
    
    // Extract table
    const tableMatch = chunk.match(/<table[\s\S]*?>([\s\S]*?)<\/table>/i);
    const headers = [];
    const rows = [];
    
    if (tableMatch) {
      const tableContent = tableMatch[1];
      
      // Headers <th>
      const thRegex = /<th[\s\S]*?>([\s\S]*?)<\/th>/gi;
      let thMatch;
      while ((thMatch = thRegex.exec(tableContent)) !== null) {
        headers.push(cleanText(thMatch[1]));
      }
      
      // Rows <tr> inside <tbody>
      const tbodyMatch = tableContent.match(/<tbody[\s\S]*?>([\s\S]*?)<\/tbody>/i) || [null, tableContent];
      const tbodyContent = tbodyMatch[1] || tableContent;
      
      const trRegex = /<tr[\s\S]*?>([\s\S]*?)<\/tr>/gi;
      let trMatch;
      while ((trMatch = trRegex.exec(tbodyContent)) !== null) {
        const rowContent = trMatch[1];
        
        // Cells <td>
        const tdRegex = /<td[\s\S]*?>([\s\S]*?)<\/td>/gi;
        let tdMatch;
        const rowCells = [];
        while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
          rowCells.push(cleanText(tdMatch[1]));
        }
        if (rowCells.length > 0) {
          rows.push(rowCells);
        }
      }
    }
    
    // Extract disclaimers
    let disclaimer = '';
    const disclaimerMatch = chunk.match(/class=['"]tbl-rates-disclaimers['"]>([\s\S]*?)(?:<\/div>|$)/i);
    if (disclaimerMatch) {
      disclaimer = cleanText(disclaimerMatch[1]);
    }
    
    result.push({
      id: currentSection.id,
      title: currentSection.title,
      headers: headers,
      rows: rows,
      disclaimer: disclaimer
    });
  }
  
  return { effectiveDate, tables: result };
}

// Fetch a rates endpoint
async function fetchRatesEndpoint(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch rates: Status ${response.status}`);
  }
  return await response.text();
}

// Refreshes the local cached rates
async function refreshRatesData() {
  console.log('Fetching MSDFCU rates from LKCS...');
  try {
    const loanHtml = await fetchRatesEndpoint('https://clients.lk-cs.com/id/62170/custom/rates/?r=248&s=0&id=62170');
    const depositHtml = await fetchRatesEndpoint('https://clients.lk-cs.com/id/62170/custom/rates/?r=235&s=0&id=62170');

    const parsedLoans = parseRatesHtml(loanHtml);
    const parsedDeposits = parseRatesHtml(depositHtml);

    ratesCache = {
      loans: parsedLoans.tables,
      deposits: parsedDeposits.tables,
      effectiveDateLoans: parsedLoans.effectiveDate,
      effectiveDateDeposits: parsedDeposits.effectiveDate,
      lastUpdated: new Date()
    };
    
    console.log('MSDFCU rates updated successfully!');
    return true;
  } catch (error) {
    console.error('Error fetching MSDFCU rates:', error.message);
    return false;
  }
}

// API Origin Lock Middleware
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const targetHost = origin || referer || '';

  if (targetHost) {
    const isLocal = targetHost.includes('localhost') || targetHost.includes('127.0.0.1');
    const isCloudRun = targetHost.includes('msdloansim-') && targetHost.includes('.run.app');
    
    if (!isLocal && !isCloudRun) {
      console.warn(`Blocked unauthorized access request from origin: ${targetHost}`);
      return res.status(403).json({ error: 'Access Denied: Unauthorized origin.' });
    }
  }
  next();
});

// Endpoint: Fetch dynamic rates
app.get('/api/rates', async (req, res) => {
  if (!ratesCache.loans || !ratesCache.deposits) {
    const success = await refreshRatesData();
    if (!success) {
      return res.status(503).json({ error: 'MSDFCU rates servers are currently unreachable. Please try again later.' });
    }
  }
  res.json(ratesCache);
});

// Endpoint: Manually refresh rates
app.post('/api/rates/refresh', async (req, res) => {
  const success = await refreshRatesData();
  if (success) {
    res.json({ message: 'Live rates refreshed successfully.', rates: ratesCache });
  } else {
    res.status(502).json({ error: 'Failed to refresh rates. MSDFCU servers may be experiencing issues.' });
  }
});

// Subdomain host redirection middleware
app.use((req, res, next) => {
  const host = req.get('host') || '';
  if (host.startsWith('psers.') || host.startsWith('teacher.')) {
    return res.redirect('https://pateacherdone.com');
  }
  next();
});

// Route: Redirect to PA Teacher retirement calculator
app.get('/psers', (req, res) => {
  res.redirect('https://pateacherdone.com');
});

// Route: Serve MSDFCU simulator
app.get('/msdfcu', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'msdfcu.html'));
});

// Route: Serve agency homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all redirect to homepage
app.get('*', (req, res) => {
  res.redirect('/');
});

// Start Express server
app.listen(PORT, async () => {
  console.log(`MSDFCU Loan Simulator server running on port ${PORT}`);
  // Hydrate cache on startup, run asynchronously so as not to block port binding
  refreshRatesData().catch(err => console.error('Initial rates fetch failed:', err.message));
});
