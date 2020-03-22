const { serverStatus } = require('../bot/botserver');
const { db, bots } = require('../db');
const { discordUrl, refreshOauth } = require('../discord');
const { logger } = require('../logger');
const uuidv4 = require('uuid/v4');
const _ = require('lodash');

function setState(req) {
  req.session.state = req.session.state || uuidv4();
  return req.session.state;
}

module.exports.loginFilter = (req, res, next) => {
  if (!req.session || !req.session.expires_at) {
    res.redirect(discordUrl(setState(req)));
  } else {
    next();
  }
};

module.exports.sessionPopulateFilter = (req, res, next) => {
  setState(req);
  if (req.session && req.session.expires_at) {
    res.locals.session = req.session;
  } else {
    res.locals.session = {};
    res.locals.discordUrl = discordUrl(req.session.state);
  }
  res.locals.serverStatus = serverStatus();
  db.count({}, (err, guildCount) => {
    if (err) logger.error(err);
    res.locals.guildCount = guildCount;
    bots.count({}, (err, botCount) => {
      if (err) logger.error(err);
      res.locals.botCount = botCount;
      next();
    });
  });
};

module.exports.refreshTokenFilter = (req, res, next) => {
  const tokenExpired = req.session && req.session.expires_at && req.session.expires_at < new Date();
  if (!tokenExpired) {
    next();
  } else if (req.session.refresh_token) {
    logger.debug('Refreshing token: ' + req.session.refresh_token);
    refreshOauth(req.session.refresh_token, body => {
      req.session.refresh_token = body.refresh_token;
      req.session.access_token = body.access_token;
      req.session.expires_at = new Date(_.toInteger(body.expires_in) * 1000 + new Date().getTime());
      next();
    });
  } else {
    logger.warn('No refresh token available, logging out');
    res.redirect('/logout');
  }
};
