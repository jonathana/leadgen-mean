/*
 The MIT License (MIT)

 Copyright (c) 2014 Jonathan M. Altman

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.

*/
'use strict';
var _ = require('lodash'),
    winston = require('winston');
var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , ObjectId = mongoose.SchemaTypes.ObjectId;

/*
var configurationDict = {
  schema: {
     fullName: {
       typeInfo: {type: String},
       displayInfo: {
         Label: 'Full Name'
       }
    }
    , addMarketing: {
      typeInfo: {type: Boolean, 'default': false},
      displayInfo: {
         label: 'I would like to receive periodic updates from Company X'
      }
    }
    , email: {
      typeInfo: {type: Boolean, 'default': false},
      displayInfo: {
        Label: 'I would like to receive periodic updates from Company X'
        formType: 'email'
      }
    }
  },
  indexes: [
    {'addMarketing': -1},
    [{'email': 1}, {unique: true}]
  ]
};
*/

module.exports = function LeadGen(connectionString, configurationDict, configurationOptions) {

  if (!(_.isString(connectionString) && _.isPlainObject(configurationDict) )) {
    throw new Error("connectionString and configurationDict must be supplied and be a string and raw object, respectively.")
  }

  var opts = configurationOptions || {};
  var logger = opts.logger || new (winston.Logger)({
    transports: [
      new (winston.transports.Console)()
    ]
  });
  var mongooseConn = mongoose.connect(connectionString, opts.mongoConnectionOptions || {});

  var CampaignUserSchema = new Schema(_.mapValues(configurationDict.schema, 'typeInfo'));
  _.each(configurationDict.indexes, function(curIndex){
    if (_.isArray(curIndex)) { CampaignUserSchema.index(curIndex[0], curIndex[1]); }
    else {  CampaignUserSchema.index(curIndex); }
  });

  var CampaignUser = mongoose.model('CampaignUser', CampaignUserSchema);

  var buildCampaignEntry = function buildCampaignUser(req) {
    console.log(req.body);
    var populatedCampaignUserDict = _.transform(configurationDict.schema, function(result, value, key){
      result[key] = req.body[key];
      return result;
    });
    console.log(populatedCampaignUserDict);
    return new CampaignUser(populatedCampaignUserDict);
  };

  return {
    saveCampaignEntry: function saveCampaignEntry(req, res) {
      var response = {status: 'error', detail: {retry: true}};
      var statusCode = 500;

      logger.debug('saveCampaignEntry: starting');

      var newEntry = buildCampaignEntry(req);

      newEntry.save(function(err, savedEntry){
        //logger.debug('saveCampaignEntry: db save returned');
        if (err) {
          //logger.warning('Error saving model', {entry: newEntry, error: err});
          if (err.code === 11000) {
            response.detail = {retry: false, errorType: 'duplicate email'};
          }
          response.detail.error = err;
        }
        else {
          //logger.debug('saveCampaignEntry: db save OK!');
          statusCode = 200;
          response = {status: 'ok'};
          try {
            emailCampaignEntry(savedEntry);
          }
          catch (e) {
            //logger.error(e);
          }
        }

        res.contentType('application/json');
        res.statusCode = statusCode;
        res.end(')]}\',\n' + JSON.stringify(response));
        //res.json(statusCode, response);
      });
    }
  };
}
