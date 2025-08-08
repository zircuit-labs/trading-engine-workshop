# trading-engine-workshop


## How to run the script
1. Install packages `yarn`
2. Fill out the `.env` as the format in `.env.example`
```
API_KEY=(This is the API Key for Gud Engine, for ETHVietnam, use: ETHVietnam2025)
PRIVATE_KEY=(your private key, with 0x prefix)
```
3. Modify `./scripts/trade.js`, modify the `QUOTE_REQUEST` so that the transaction you execute is what you intended.
4. Execute `yarn node ./scripts/trade.js`
