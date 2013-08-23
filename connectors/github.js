
var githubApi = require('github');

var githubModels = require('../models/github.js');
var Issue = githubModels.Issue;
var Comment = githubModels.Comment;
var Hook = githubModels.Hook;

function GithubConnector() {
  this.userName = null;
  this.password = null;
  this.github = new githubApi({
    version : "3.0.0"
  });
}

/**
 * Set the Github Authentication information
 *
 * @param {String} username
 * @param {String} password
 *
 */

GithubConnector.prototype.setAuthInfo = function (userName, password) {
  this.userName = userName;
  this.password = password;
}

/**
 * Internal function to setup auth before each method
 *
 * @private
 */

GithubConnector.prototype.setupAuth = function () {
  this.github.authenticate({
    type : "basic",
    username : this.userName,
    password : this.password
  });
}

/**
 * Get all of the issues associated with a given repo that are assigned to a
 * specified user. Returns unsaved mongoose models of the issues
 *
 * @param {Object} repo - { user : ..., name : ... }
 * @param {String} user
 * @param {Function} callback - function(err, issues)
 *
 */

GithubConnector.prototype.getAllRepoIssues = function (repo, user, callback) {
  this.setupAuth();

  var msg = {
    user : repo.user,
    repo : repo.name,
    assignee : user,
    per_page : 100
  };
  var rIssues = [];
  var self = this;
  this.github.issues.repoIssues(msg, function (err, issues) {
    if (err) {
      return callback(err);
    }

    for (var i=0; i < issues.length; i++) {
      var is = new Issue(issues[i]);
      is.repo = repo;
      rIssues.push(is);
    }

    if (issues.meta.link) {
      // get the last page number
      var meta = issues.meta.link.split(',');
      var pageRegex = /page=(\d*)>/;
      var page = parseInt(meta[1].match(pageRegex)[1]);

      var count = page - 1;
      for (var i=2; i < page+1; i++) {
        self.setupAuth();
        msg.page = i;
        self.github.issues.repoIssues(msg, function (err, issues) {
          if (err) {
            return callback(err);
          }
          issues.map(function (item) {
            var is = new Issue(item);
            is.repo = repo;
            rIssues.push(is);
          });
          --count || callback(null, rIssues);
        });
      }
    } else {
      return callback(err, rIssues);
    }
  });
}

/**
 *
 * Get all of the comments for a specified issue. Return unsaved mongoose
 * models of the comments
 *
 * @param {Issue} issue
 * @param {Function} callback - function(err, comments)
 *
 */

GithubConnector.prototype.getAllCommentsForIssue = function (issue, callback) {
  this.setupAuth();

  var msg = {
    user : issue.repo.user,
    repo : issue.repo.name,
    number : issue.number,
    per_page : 100
  };

  var self = this;
  var rComments = [];
  this.github.issues.getComments(msg, function (err, comments) {
    if (err) {
      return callback(err);
    }

    for (var i=0; i < comments.length; i++) {
      var c = new Comment(comments[i]);
      c.issue = issue;
      rComments.push(c);
    }

    if (comments.meta.link) {
      // get the last page number
      var meta = comments.meta.link.split(',');
      var pageRegex = /page=(\d*)>/;
      var page = parseInt(meta[1].match(pageRegex)[1]);

      var count = page - 1;
      for (var i=2; i < page+1; i++) {
        self.setupAuth();
        msg.page = i;
        self.github.issues.getComments(msg, function (err, comments) {
          if (err) {
            return callback(err);
          }
          comments.map(function (item) {
            var c = new Comment(item);
            c.issue = issue;
            rComments.push(c);
          });
          --count || callback(null, rComments);
        });
      }
    } else {
      return callback(err, rComments);
    }
  });
}

/**
 *
 * Creates a webhook on a repository
 *
 * @param {Object} repo - { user : ..., name : ... }
 * @param {Array} events - an array of the string names for the events to watch
 * @param {String} url - ping url for the webhook
 * @param {Function} callback - function(err, hook)
 *
 */

GithubConnector.prototype.createWebHook = function(repo, events, url, callback) {
  this.setupAuth();

  var msg = {
    user : repo.user,
    repo : repo.name,
    name : "web",
    events : events,
    config : {
      url : url,
      content_type : "json"
    }
  };

  this.github.repos.createHook(msg, function (err, hook) {
    if (err) {
      if (err.message) {
        try {
          err = JSON.parse(err.message);
        } catch (e) {

        }
      }
      return callback(err);
    }

    var hook = new Hook(hook);
    hook.repo.user = repo.user;
    hook.repo.name = repo.name;

    var raw = hook.toObject();
    Hook.findOneAndUpdate({ id : hook.id }, raw, { upsert : true }, callback);
  });
}

/**
 *
 * Deletes a webhook on a repo
 *
 * @param {Object} repo
 * @param {Number} id - id of the webhook
 * @param {Function} callback - function(err)
 *
 */

GithubConnector.prototype.deleteWebHook = function(repo, id, callback) {
  this.setupAuth();

  var msg = {
    user : repo.user,
    repo : repo.name,
    id : id
  };

  this.github.repos.deleteHook(msg, callback);
}

/**
 *
 * Get all of the webhooks on a repo
 *
 * @param {Object} repo
 * @param {Function} callback - function(err, hooks)
 *
 */

GithubConnector.prototype.getHooks = function(repo, callback) {
  this.setupAuth();

  var msg = {
    user : repo.user,
    repo : repo.name
  };

  this.github.repos.getHooks(msg, callback);
}


module.exports = exports = new GithubConnector();
