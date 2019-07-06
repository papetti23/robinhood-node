/**
 * Robinhood API NodeJS Wrapper
 * @author Alejandro U. Alvarez
 * @license AGPLv3 - See LICENSE file for more details
 * @version 1.1.2
 */

'use strict';

// Dependencies
var request = require('request');
var Promise = require('promise');
var _ = require('lodash');
var queryString = require('query-string');

function RobinhoodWebApi(opts, callback) {

  /* +--------------------------------+ *
   * |      Internal variables        | *
   * +--------------------------------+ */
  var _apiUrl = 'https://api.robinhood.com/';

  var _options = opts || {},
      // Private API Endpoints
      _endpoints = {
        login:  'oauth2/token/',
        logout: 'oauth2/revoke_token/',
        investment_profile: 'user/investment_profile/',
        accounts: 'accounts/',
        ach_iav_auth: 'ach/iav/auth/',
        ach_relationships:  'ach/relationships/',
        ach_transfers:'ach/transfers/',
        ach_deposit_schedules: "ach/deposit_schedules/",
        applications: 'applications/',
        dividends:  'dividends/',
        edocuments: 'documents/',
        instruments:  'instruments/',
        margin_upgrade:  'margin/upgrades/',
        markets:  'markets/',
        notifications:  'notifications/',
        notifications_devices: "notifications/devices/",
        orders: 'orders/',
        cancel_order: 'orders/',      //API expects https://api.robinhood.com/orders/{{orderId}}/cancel/
        password_reset: 'password_reset/request/',
        quotes: 'quotes/',
        document_requests:  'upload/document_requests/',
        user: 'user/',

        user_additional_info: "user/additional_info/",
        user_basic_info: "user/basic_info/",
        user_employment: "user/employment/",
        user_investment_profile: "user/investment_profile/",

        options_positions: "options/aggregate_positions/",
        watchlists: 'watchlists/',
        positions: 'positions/',
        fundamentals: 'fundamentals/',
        sp500_up: 'midlands/movers/sp500/?direction=up',
        sp500_down: 'midlands/movers/sp500/?direction=down',
        news: 'midlands/news/'
    },
    _clientId = 'c82SH0WZOsabOXGP2sxqcj34FxkvfnWRZBKlBjFS',
    _isInit = false,
    _request = request.defaults(),
    _private = {
      session : {},
      account: null,
      username : null,
      password : null,
      headers : null,
      auth_token : null,
      refresh_token: null
    },
    api = {};

  function _init(){
    _private.username = _.has(_options, 'username') ? _options.username : null;
    _private.password = _.has(_options, 'password') ? _options.password : null;
    _private.auth_token = _.has(_options, 'token') ? _options.token : null;
    _private.headers = {
      'Accept': '*/*',
      'Accept-Encoding': 'br, gzip, deflate',
      'Accept-Language': 'en-us',
      'Content-Length':239,
      'Content-Type': 'application/json',
      'Connection': 'keep-alive',
      'X-Robinhood-API-Version': '1.275.0',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0.3 Safari/605.1.15'

    };
    _setHeaders();
    if (!_private.auth_token) {
    _login(function(){
        _isInit = true;

        if (callback) {
          callback.call();
        }
      });
    } else {
      _build_auth_header(_private.auth_token);
      _setHeaders();
      _set_account().then(function() {
        callback.call();
      }).catch(function(err) {
        throw (err);
      });
    }
  }

  function _setHeaders(){
    _request = request.defaults({
      headers: _private.headers,
      json: true,
      gzip: true
    });
  }

  function _login(callback){


    _request.post({
      uri: _apiUrl + _endpoints.login,
      body: {
        grant_type: "password",
        scope: "internal",
        client_id: _clientId,
        expires_in: 86400,
        password: _private.password,
        username: _private.username,
        device_token: 'e839fe23-d8d1-4ef4-bef9-751e3d442fec'
      },
      json:true,
      headers: _private.headers

    }, function(err, httpResponse, body) {
      if(err) {
        throw (err);
      }
      if (!body.access_token) {
           throw new Error(
               "token not found " + JSON.stringify(httpResponse)
           )


      }

        _private.auth_token = body.access_token;
        _private.refresh_token = body.refresh_token;
        _build_auth_header(_private.auth_token);

      _setHeaders();
      // Set account
      _set_account().then(function() {
        callback.call();
      }).catch(function(err) {
        throw (err);
      })

    });
  }

  function _set_account() {
    return new Promise(function(resolve, reject) {
      api.accounts(function(err, httpResponse, body) {
        if (err) {
          reject(err);
        }
        // Being defensive when user credentials are valid but RH has not approved an account yet
        if (body.results && body.results instanceof Array && body.results.length > 0) {
          _private.account = body.results[0].url;
        }
        resolve();
      });
    });
  }

  function _build_auth_header(token) {
    _private.headers.Authorization = 'Bearer ' + token;
  }

  /* +--------------------------------+ *
   * |      Define API methods        | *
   * +--------------------------------+ */

  api.auth_token = function() {
    return _private.auth_token;
  };

  // Invoke robinhood logout.  Note: User will need to reintantiate
  // this package to get a new token!
  api.expire_token = function(callback) {
    return _request.post({
      uri: _apiUrl + _endpoints.logout,

      form: {
        client_id: _clientId,
        token: _private.refresh_token
      }

    }, callback);
  };

  api.investment_profile = function(callback){
    return _request.get({
        uri: _apiUrl + _endpoints.investment_profile
      }, callback);
  };

  api.fundamentals = function(ticker, callback){
    return _request.get({
		uri: _apiUrl + [_endpoints.fundamentals,'/'].join(String(ticker).toUpperCase()),
      }, callback);
  };

  api.instruments = function(symbol, callback){
    return _request.get({
        uri: _apiUrl + _endpoints.instruments,
        qs: {'query': symbol.toUpperCase()}
      }, callback);
  };

  api.popularity = function(symbol, callback){
    return api.quote_data(symbol, function (error, response, body) {
        if (error) {
            return callback(error, response, body);
        }

        // ex. https://api.robinhood.com/instruments/edf89445-db53-4f97-9de9-a599a293c63f/
        var symbol_uuid = body.results[0].instrument.split('/')[4];

        return _request.get({
            uri: _apiUrl + _endpoints.instruments + symbol_uuid + '/popularity/',
        }, callback);
    });
  };

  api.quote_data = function(symbol, callback){
    symbol = Array.isArray(symbol) ? symbol = symbol.join(',') : symbol;
    return _request.get({
        uri: _apiUrl + _endpoints.quotes,
        qs: { 'symbols': symbol.toUpperCase() }
      }, callback);
  };

  api.accounts= function(callback){
    return _request.get({
      uri: _apiUrl + _endpoints.accounts
    }, callback);
  };

  api.user = function(callback){
    return _request.get({
      uri: _apiUrl + _endpoints.user
    }, callback);
  };

  api.dividends = function(callback){
    return _request.get({
      uri: _apiUrl + _endpoints.dividends
    }, callback);
  };

  api.earnings = function(options, callback){
    return _request.get({
      uri: _apiUrl + _endpoints.earnings +
        (options.instrument ? "?instrument="+options.instrument :
         options.symbol ? "?symbol="+options.symbol :
         "?range="+(options.range ? options.range : 1)+"day")
    }, callback);
  };

  api.orders = function(){
    var options = {}, callback = new Function(), args = _.values(arguments);
    args.forEach(function(arg) {
      if (typeof arg === 'function') callback = arg;

      if (typeof arg === 'object') options = arg;     // Keep in mind, instrument option must be the full instrument url!
    });


    var hasOptions = _.keys(options).length > 0;



    if (hasOptions) {
      options['updated_at[gte]'] = options.updated_at;
      _.unset(options, 'updated_at');
    }
    return _request.get({
      uri: _apiUrl + _endpoints.orders + (hasOptions ? '?' + queryString.stringify(options) : '')
    }, callback);
  };

  api.cancel_order = function(order, callback){
    if(order.cancel){
      return _request.post({
        uri: order.cancel // use the cancel url provided by the order object
      }, callback);
    }else{
      callback({message: order.state=="cancelled" ? "Order already cancelled." : "Order cannot be cancelled.", order: order }, null, null);
    };
  }

  var _place_order = function(options, callback){
    return _request.post({
        uri: _apiUrl + _endpoints.orders,
        form: {
          account: _private.account,
          instrument: options.instrument.url,
          price: options.bid_price,
          stop_price: options.stop_price,
          quantity: options.quantity,
          side: options.transaction,
          symbol: options.instrument.symbol.toUpperCase(),
          time_in_force: options.time || 'gfd',
          trigger: options.trigger || 'immediate',
          type: options.type || 'market'
        }
      }, callback);
  };

  api.place_buy_order = function(options, callback){
    options.transaction = 'buy';
    return _place_order(options, callback);
  };

  api.place_sell_order = function(options, callback){
    options.transaction = 'sell';
    return _place_order(options, callback);
  };

  api.positions = function(callback){
    return _request.get({
      uri: _apiUrl + _endpoints.positions
    }, callback);
  };

  api.nonzero_positions = function(callback){
    return _request.get({
      uri: _apiUrl + _endpoints.positions,
      qs: {nonzero: true}
    }, callback);
  };

  api.options_positions = function (callback) {
    return _request.get({
      uri: _apiUrl + _endpoints.options_positions,
    }, callback);
  };

  api.news = function(symbol, callback){
    return _request.get({
      uri: _apiUrl + [_endpoints.news,'/'].join(symbol)
    }, callback);
  };


  api.tag = function(tag, callback){
    return _request.get({
      uri: _apiUrl + _endpoints.tag + tag
    }, callback);
  };

  api.markets = function(callback){
    return _request.get({
      uri: _apiUrl + _endpoints.markets
    }, callback);
  };

  api.sp500_up = function(callback){
    return _request.get({
      uri: _apiUrl + _endpoints.sp500_up
    }, callback);
  };

  api.sp500_down = function(callback){
    return _request.get({
      uri: _apiUrl + _endpoints.sp500_down
    }, callback);
  };

  api.create_watch_list = function(name, callback){
    return _request.post({
        uri: _apiUrl + _endpoints.watchlists,
        form: {
          name: name
        }
      }, callback);
  };

  api.watchlists = function(callback){
    return _request.get({
        uri: _apiUrl + _endpoints.watchlists
      }, callback);
  };

  api.splits = function(instrument, callback){
    return _request.get({
        uri: _apiUrl + [_endpoints.instruments,'/splits/'].join(instrument)
      }, callback);
  };

  api.historicals = function(symbol, intv, span, callback){
    return _request.get({
        uri: _apiUrl + [_endpoints.quotes + 'historicals/','/?interval='+intv+'&span='+span].join(symbol)
      }, callback);
  };

  api.url = function (url,callback){
    return _request.get({
      uri:url
    },callback);
  };

  _init(_options);

  return api;
}

module.exports = RobinhoodWebApi;
