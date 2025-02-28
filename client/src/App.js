import React, { useState } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import './App.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function App() {
  const [stockData, setStockData] = useState(null);
  const [symbol, setSymbol] = useState('');
  const [timeframe, setTimeframe] = useState('1d');
  const [suggestions, setSuggestions] = useState([]);
  const [news, setNews] = useState([]);

  const fetchStock = async () => {
    console.log('Fetching stock:', symbol, timeframe);
    try {
      const response = await axios.get(`http://localhost:3001/stocks?symbol=${symbol}&timeframe=${timeframe}`);
      console.log('Stock data:', response.data);
      setStockData(response.data);
      setSuggestions([]);
      fetchNews(symbol);
    } catch (error) {
      console.error('Fetch error:', error.message);
      setStockData(null);
    }
  };

  const fetchNews = async (stockSymbol) => {
    try {
      const response = await axios.get(`http://localhost:3001/news?symbol=${stockSymbol}`);
      console.log('News data:', response.data);
      setNews(response.data);
    } catch (error) {
      console.error('News fetch error:', error);
      setNews([]);
    }
  };

  const handleInputChange = async (e) => {
    const value = e.target.value.toUpperCase();
    setSymbol(value);
    if (value.length >= 2) {
      try {
        const response = await axios.get(`http://localhost:3001/search?q=${value}`);
        console.log('Suggestions:', response.data);
        setSuggestions(response.data);
      } catch (error) {
        console.error('Suggestion fetch error:', error);
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setSymbol(suggestion.symbol);
    setSuggestions([]);
    fetchStock();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted with symbol:', symbol);
    if (symbol) fetchStock();
  };

  const chartData = stockData && stockData.historical && stockData.historical.quotes ? {
    labels: stockData.historical.quotes.map(q => {
      const date = new Date(q.date);
      return timeframe === '1d' ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString();
    }),
    datasets: [{
      label: stockData && stockData.quote && stockData.quote.Symbol ? `${stockData.quote.Symbol} Price ($)` : 'Price ($)',
      data: stockData.historical.quotes.map(q => q.close),
      borderColor: '#007bff',
      backgroundColor: 'rgba(0, 123, 255, 0.1)',
      fill: true,
    }],
  } : { labels: [], datasets: [] };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { 
        display: true, 
        text: stockData && stockData.quote && stockData.quote.Symbol ? `${stockData.quote.Symbol} - ${timeframe.toUpperCase()}` : 'Stock Chart', 
        font: { size: 20 } 
      },
    },
    scales: {
      y: { title: { display: true, text: 'Price ($)' } },
      x: { title: { display: true, text: timeframe === '1d' ? 'Time' : 'Date' } },
    },
  };

  return (
    <div className="App">
      <h1>Stock Portfolio Tracker</h1>
      <form onSubmit={handleSubmit}>
        <div className="input-container">
          <input
            type="text"
            value={symbol}
            onChange={handleInputChange}
            placeholder="Enter stock symbol (e.g., AAPL)"
            className="stock-input"
          />
          {suggestions.length > 0 && (
            <ul className="suggestions">
              {suggestions.map((s, index) => (
                <li key={index} onClick={() => handleSuggestionClick(s)}>
                  {s.symbol} - {s.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className="timeframe-select">
          <option value="1d">Daily</option>
          <option value="1wk">Weekly</option>
          <option value="1mo">Monthly</option>
          <option value="1y">Yearly</option>
        </select>
        <button type="submit">Get Stock</button>
      </form>
      <div className="content-wrapper">
        <div className="content">
          {stockData && stockData.quote ? (
            <div className="stock-details left">
              <h2>{stockData.quote.Name || 'Unknown'} ({stockData.quote.Symbol || symbol || 'N/A'})</h2>
              <p>{stockData.quote.Description || 'No company overview available.'}</p>
              <p><strong>Sector:</strong> {stockData.quote.Sector || 'N/A'} | <strong>Industry:</strong> {stockData.quote.Industry || 'N/A'}</p>
              <p><strong>Website:</strong> {stockData.quote.Symbol ? (
                <a href={`https://www.${stockData.quote.Symbol.toLowerCase()}.com`} target="_blank" rel="noopener noreferrer">
                  {stockData.quote.Symbol.toLowerCase()}.com
                </a>
              ) : 'N/A'}</p>
              <p><strong>Current Price:</strong> ${stockData.quote['50DayMovingAverage'] || 'N/A'} | <strong>Market Cap:</strong> ${stockData.quote.MarketCapitalization || 'N/A'}</p>
            </div>
          ) : (
            <div className="left"><p>No stock data yet</p></div>
          )}
          <div className="chart-container right">
            {stockData && stockData.historical && stockData.historical.quotes && stockData.historical.quotes.length > 0 ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <p>No chart data available</p>
            )}
          </div>
        </div>
        <div className="news-container">
          <h3>Latest News</h3>
          <div className="news-scroll">
            {news.length > 0 ? (
              news.map((item, index) => (
                <p key={index}>{item.date}: {item.title}</p>
              ))
            ) : (
              <p>No news available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;