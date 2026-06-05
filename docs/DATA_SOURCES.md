# Data Sources

The source directory is also rendered in `/sources-methodology`.

Key providers include Unusual Whales website pages, Capitol Trades, sec-api.io, Finnhub, Twelve Data, CoinGecko crypto endpoints, FRED, CBOE, AAII, and optional HormuzTracker.

Oil prices should use Finnhub, Twelve Data, FRED where appropriate, or another available market data provider. Oil historical charts should prefer Twelve Data if available. Oil macro context can use FRED.

Unusual Whales should be ingested by server-side scraping only. The Today tab uses `https://unusualwhales.com/news`; News & Calendar uses `https://unusualwhales.com/news-feed?limit=100&major_only=true`.
