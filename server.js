const express = require('express');
const axios = require('axios');
const { MongoClient } = require('mongodb');
const cache = require('memory-cache');
const cors = require('cors');

const app = express();
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://gayathri:G3mongodb@cluster0.i4ngl.mongodb.net/stock_portfolio?retryWrites=true&w=majority&appName=Cluster0';

let db;

async function connectDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db('stock_portfolio');
  console.log('Connected to MongoDB Atlas');
}

connectDB().catch(console.error);

app.use(cors());
app.use(express.json());

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
    const overviewResponse = await axios.get(`https://www.alphavantage.co/query`, {
      params: {
        function: 'OVERVIEW',
        symbol: symbol,
        apikey: ALPHA_VANTAGE_API_KEY
      }
    });
    const quote = overviewResponse.data;

    const intervalMap = { '1d': '60min', '1wk': 'DAILY', '1mo': 'DAILY', '1y': 'DAILY' };
    const functionMap = { '1d': 'TIME_SERIES_INTRADAY', '1wk': 'TIME_SERIES_DAILY', '1mo': 'TIME_SERIES_DAILY', '1y': 'TIME_SERIES_DAILY' };
    const timeSeriesResponse = await axios.get(`https://www.alphavantage.co/query`, {
      params: {
        function: functionMap[timeframe],
        symbol: symbol,
        interval: timeframe === '1d' ? intervalMap[timeframe] : undefined,
        apikey: ALPHA_VANTAGE_API_KEY,
        outputsize: timeframe === '1d' ? 'compact' : 'full'
      }
    });
    const timeSeriesKey = timeframe === '1d' ? `Time Series (60min)` : 'Time Series (Daily)';
    const timeSeriesData = timeSeriesResponse.data[timeSeriesKey] || {};
    const quotes = Object.entries(timeSeriesData).map(([date, values]) => ({
      date: date,
      close: parseFloat(values['4. close'])
    })).slice(0, timeframe === '1d' ? 24 : timeframe === '1wk' ? 5 : timeframe === '1mo' ? 30 : 252);

    const data = { quote, historical: { quotes } };
    const endTime = Date.now();
    console.log(`API fetch for ${symbol} (${timeframe}) took ${(endTime - startTime) / 1000}s`);

    await db.collection('stocks').updateOne(
      { symbol, timeframe },
      { $set: data },
      { upsert: true }
    );

    cache.put(cacheKey, data, 10000);
    res.json(data);
  } catch (error) {
    console.error('Error fetching stock:', error.message);
    res.status(500).json({ error: 'API fetch failed', details: error.message });
  }
});

app.get('/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    console.log('Searching for:', query);
    const response = await axios.get(`https://www.alphavantage.co/query`, {
      params: {
        function: 'SYMBOL_SEARCH',
        keywords: query,
        apikey: ALPHA_VANTAGE_API_KEY
      }
    });
    console.log('Raw search response:', response.data);
    const suggestions = response.data.bestMatches ? response.data.bestMatches.map(match => ({
      symbol: match['1. symbol'],
      name: match['2. name']
    })) : [];
    console.log('Search results:', suggestions);
    res.json(suggestions);
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

app.get('/news', async (req, res) => {
  try {
    const symbol = req.query.symbol || 'AAPL';
    console.log('Fetching news for:', symbol);
    const response = await axios.get(`https://www.alphavantage.co/query`, {
      params: {
        function: 'NEWS_SENTIMENT',
        tickers: symbol,
        apikey: ALPHA_VANTAGE_API_KEY
      }
    });
    const news = response.data.feed ? response.data.feed.slice(0, 5).map(item => ({
      title: item.title,
      date: item.time_published.slice(0, 10)
    })) : [];
    console.log('News results:', news);
    res.json(news);
  } catch (error) {
    console.error('News error:', error);
    res.status(500).json({ error: 'News fetch failed', details: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});