const express = require('express');
const yahooFinance = require('yahoo-finance2').default;
const cache = require('memory-cache');
const cors = require('cors');

const app = express();
const port = 3001;

app.use(cors());

app.get('/stocks', async (req, res) => {
  try {
    const symbol = req.query.symbol || 'AAPL';
    const timeframe = req.query.timeframe || '1d';
    const cacheKey = `stock_${symbol}_${timeframe}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      console.log(`Serving ${symbol} (${timeframe}) from cache`);
      return res.json(cachedData);
    }

    const startTime = Date.now();
    console.log('Fetching quote for:', symbol);
    const quote = await yahooFinance.quote(symbol); // Current data
    console.log('Fetching historical for:', symbol, timeframe);
    const historical = await yahooFinance.chart(symbol, { 
      period1: getPeriod(timeframe), 
      interval: timeframe === '1d' ? '1h' : '1d' // Hourly for 1d, daily for others
    });
    const data = { 
      quote, 
      historical: { 
        quotes: historical.quotes.map(q => ({
          date: q.date,
          close: q.close
        }))
      } 
    };
    const endTime = Date.now();
    console.log(`API fetch for ${symbol} (${timeframe}) took ${(endTime - startTime) / 1000}s`);

    cache.put(cacheKey, data, 10000);
    res.json(data);
  } catch (error) {
    console.error('Error fetching stock:', error);
    res.status(500).json({ error: 'API fetch failed', details: error.message });
  }
});

function getPeriod(timeframe) {
  const now = Date.now();
  switch (timeframe) {
    case '1d': return new Date(now - 24 * 60 * 60 * 1000).toISOString();
    case '1wk': return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    case '1mo': return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    case '1y': return new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString();
    default: return new Date(now - 24 * 60 * 60 * 1000).toISOString();
  }
}

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});