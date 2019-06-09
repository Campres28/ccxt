'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { ArgumentsRequired, ExchangeError } = require ('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class bit2c extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'bit2c',
            'name': 'Bit2C',
            'countries': [ 'IL' ], // Israel
            'rateLimit': 3000,
            'has': {
                'CORS': false,
                'fetchOpenOrders': true,
                'fetchMyTrades': true,
            },
            'urls': {
                'logo': 'https://user-images.githubusercontent.com/1294454/27766119-3593220e-5ece-11e7-8b3a-5a041f6bcc3f.jpg',
                'api': 'https://bit2c.co.il',
                'www': 'https://www.bit2c.co.il',
                'doc': [
                    'https://www.bit2c.co.il/home/api',
                    'https://github.com/OferE/bit2c',
                ],
            },
            'api': {
                'public': {
                    'get': [
                        'Exchanges/{pair}/Ticker',
                        'Exchanges/{pair}/orderbook',
                        'Exchanges/{pair}/trades',
                        'Exchanges/{pair}/lasttrades',
                    ],
                },
                'private': {
                    'post': [
                        'Merchant/CreateCheckout',
                        'Order/AddCoinFundsRequest',
                        'Order/AddFund',
                        'Order/AddOrder',
                        'Order/AddOrderMarketPriceBuy',
                        'Order/AddOrderMarketPriceSell',
                        'Order/CancelOrder',
                        'Order/AddCoinFundsRequest',
                        'Order/AddStopOrder',
                        'Payment/GetMyId',
                        'Payment/Send',
                        'Payment/Pay',
                    ],
                    'get': [
                        'Account/Balance',
                        'Account/Balance/v2',
                        'Order/MyOrders',
                        'Order/GetById',
                        'Order/AccountHistory',
                        'Order/OrderHistory',
                    ],
                },
            },
            'markets': {
                'BTC/NIS': { 'id': 'BtcNis', 'symbol': 'BTC/NIS', 'base': 'BTC', 'quote': 'NIS' },
                'ETH/NIS': { 'id': 'EthNis', 'symbol': 'ETH/NIS', 'base': 'ETH', 'quote': 'NIS' },
                'BCH/NIS': { 'id': 'BchabcNis', 'symbol': 'BCH/NIS', 'base': 'BCH', 'quote': 'NIS' },
                'LTC/NIS': { 'id': 'LtcNis', 'symbol': 'LTC/NIS', 'base': 'LTC', 'quote': 'NIS' },
                'ETC/NIS': { 'id': 'EtcNis', 'symbol': 'ETC/NIS', 'base': 'ETC', 'quote': 'NIS' },
                'BTG/NIS': { 'id': 'BtgNis', 'symbol': 'BTG/NIS', 'base': 'BTG', 'quote': 'NIS' },
                'BSV/NIS': { 'id': 'BchsvNis', 'symbol': 'BSV/NIS', 'base': 'BSV', 'quote': 'NIS' },
                'GRIN/NIS': { 'id': 'GrinNis', 'symbol': 'GRIN/NIS', 'base': 'GRIN', 'quote': 'NIS' },
            },
            'fees': {
                'trading': {
                    'maker': 0.5 / 100,
                    'taker': 0.5 / 100,
                },
            },
            'options': {
                'fetchTradesMethod': 'public_get_exchanges_pair_lasttrades',
            },
        });
    }

    async fetchBalance (params = {}) {
        let balance = await this.privateGetAccountBalanceV2 ();
        let result = { 'info': balance };
        let currencies = Object.keys (this.currencies);
        for (let i = 0; i < currencies.length; i++) {
            let currency = currencies[i];
            let account = this.account ();
            if (currency in balance) {
                let available = 'AVAILABLE_' + currency;
                account['free'] = balance[available];
                account['total'] = balance[currency];
                account['used'] = account['total'] - account['free'];
            }
            result[currency] = account;
        }
        return this.parseBalance (result);
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        let orderbook = await this.publicGetExchangesPairOrderbook (this.extend ({
            'pair': this.marketId (symbol),
        }, params));
        return this.parseOrderBook (orderbook);
    }

    async fetchTicker (symbol, params = {}) {
        let ticker = await this.publicGetExchangesPairTicker (this.extend ({
            'pair': this.marketId (symbol),
        }, params));
        let timestamp = this.milliseconds ();
        let averagePrice = this.safeFloat (ticker, 'av');
        let baseVolume = this.safeFloat (ticker, 'a');
        let quoteVolume = undefined;
        if (baseVolume !== undefined && averagePrice !== undefined)
            quoteVolume = baseVolume * averagePrice;
        let last = this.safeFloat (ticker, 'll');
        return {
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'high': undefined,
            'low': undefined,
            'bid': this.safeFloat (ticker, 'h'),
            'bidVolume': undefined,
            'ask': this.safeFloat (ticker, 'l'),
            'askVolume': undefined,
            'vwap': undefined,
            'open': undefined,
            'close': last,
            'last': last,
            'previousClose': undefined,
            'change': undefined,
            'percentage': undefined,
            'average': averagePrice,
            'baseVolume': baseVolume,
            'quoteVolume': quoteVolume,
            'info': ticker,
        };
    }

    async fetchTrades (symbol, since = undefined, limit = undefined, params = {}) {
        let market = this.market (symbol);
        let method = this.options['fetchTradesMethod'];
        let response = await this[method] (this.extend ({
            'pair': market['id'],
        }, params));
        if (typeof response === 'string') {
            throw new ExchangeError (response);
        }
        return this.parseTrades (response, market, since, limit);
    }

    async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
        let method = 'privatePostOrderAddOrder';
        const request = {
            'Amount': amount,
            'Pair': this.marketId (symbol),
        };
        if (type === 'market') {
            method += 'MarketPrice' + this.capitalize (side);
        } else {
            request['Price'] = price;
            request['Total'] = amount * price;
            request['IsBid'] = (side === 'buy');
        }
        const response = await this[method] (this.extend (request, params));
        return {
            'info': response,
            'id': response['NewOrder']['id'],
        };
    }

    async cancelOrder (id, symbol = undefined, params = {}) {
        return await this.privatePostOrderCancelOrder ({ 'id': id });
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let url = this.urls['api'] + '/' + this.implodeParams (path, params);
        if (api === 'public') {
            // lasttrades is the only endpoint that doesn't require the .json extension/suffix
            if (path.indexOf ('lasttrades') < 0) {
                url += '.json';
            }
        } else {
            this.checkRequiredCredentials ();
            let nonce = this.nonce ();
            let query = this.extend ({ 'nonce': nonce }, params);
            body = this.urlencode (query);
            let signature = this.hmac (this.encode (body), this.encode (this.secret), 'sha512', 'base64');
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'key': this.apiKey,
                'sign': this.decode (signature),
            };
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

    async fetchOpenOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' fetchOpenOrders() requires a symbol argument');
        }
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'pair': market['id'],
        };
        const response = await this.privateGetOrderMyOrders (this.extend (request, params));
        const orders = this.safeValue (response, market['id'], {});
        const asks = this.safeValue (orders, 'ask', []);
        const bids = this.safeValue (orders, 'bid', []);
        return this.parseOrders (this.arrayConcat (asks, bids), market, since, limit);
    }

    parseOrder (order, market = undefined) {
        let timestamp = order['created'];
        let price = order['price'];
        let amount = order['amount'];
        let cost = price * amount;
        let symbol = undefined;
        if (market !== undefined)
            symbol = market['symbol'];
        let side = this.safeValue (order, 'type');
        if (side === 0) {
            side = 'buy';
        } else if (side === 1) {
            side = 'sell';
        }
        let id = this.safeString (order, 'id');
        let status = this.safeString (order, 'status');
        return {
            'id': id,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'lastTradeTimestamp': undefined,
            'status': status,
            'symbol': symbol,
            'type': undefined,
            'side': side,
            'price': price,
            'amount': amount,
            'filled': undefined,
            'remaining': undefined,
            'cost': cost,
            'trades': undefined,
            'fee': undefined,
            'info': order,
        };
    }

    async fetchMyTrades (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        let market = undefined;
        let method = 'privateGetOrderOrderhistory';
        let request = {};
        if (limit !== undefined)
            request['take'] = limit;
        request['take'] = limit;
        if (since !== undefined) {
            request['toTime'] = this.ymd (this.milliseconds (), '.');
            request['fromTime'] = this.ymd (since, '.');
        }
        if (symbol !== undefined) {
            market = this.market (symbol);
            request['pair'] = market['id'];
        }
        let response = await this[method] (this.extend (request, params));
        return this.parseTrades (response, market, since, limit);
    }

    parseTrade (trade, market = undefined) {
        let timestamp = undefined;
        let id = undefined;
        let price = undefined;
        let amount = undefined;
        let orderId = undefined;
        let feeCost = undefined;
        let side = undefined;
        let reference = this.safeString (trade, 'reference');
        if (reference !== undefined) {
            timestamp = this.safeInteger (trade, 'ticks') * 1000;
            price = this.safeFloat (trade, 'price');
            amount = this.safeFloat (trade, 'firstAmount');
            let reference_parts = reference.split ('|'); // reference contains: 'pair|orderId|tradeId'
            if (market === undefined) {
                let marketId = this.safeString (trade, 'pair');
                if (marketId in this.markets_by_id[marketId]) {
                    market = this.markets_by_id[marketId];
                } else if (reference_parts[0] in this.markets_by_id) {
                    market = this.markets_by_id[reference_parts[0]];
                }
            }
            orderId = reference_parts[1];
            id = reference_parts[2];
            side = this.safeInteger (trade, 'action');
            if (side === 0) {
                side = 'buy';
            } else if (side === 1) {
                side = 'sell';
            }
            feeCost = this.safeFloat (trade, 'feeAmount');
        } else {
            timestamp = this.safeInteger (trade, 'date') * 1000;
            id = this.safeString (trade, 'tid');
            price = this.safeFloat (trade, 'price');
            amount = this.safeFloat (trade, 'amount');
            side = this.safeValue (trade, 'isBid');
            if (side !== undefined) {
                if (side) {
                    side = 'buy';
                } else {
                    side = 'sell';
                }
            }
        }
        let symbol = undefined;
        if (market !== undefined)
            symbol = market['symbol'];
        return {
            'info': trade,
            'id': id,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'symbol': symbol,
            'order': orderId,
            'type': undefined,
            'side': side,
            'takerOrMaker': undefined,
            'price': price,
            'amount': amount,
            'cost': price * amount,
            'fee': {
                'cost': feeCost,
                'currency': 'NIS',
                'rate': undefined,
            },
        };
    }
};

