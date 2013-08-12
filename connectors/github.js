
var githubApi = require('github');

var githubModels = require('../models/github.js');
var Issue = githubModels.Issue;
var Comment = githubModels.Comment;

function GithubConnector() {
  this.userName = null;
  this.password = null;
  this.github = new githubApi({
    version : "3.0.0"
  });
}

GithubConnector.prototype.setAuthInfo = function (userName, password) {
  this.userName = userName;
  this.password = password;
}

GithubConnector.prototype.setupAuth = function () {
  this.github.authenticate({
    type : "basic",
    username : this.userName,
    password : this.password
  });
}

GithubConnector.prototype.getAllRepoIssues = function (repo, callback) {
  this.setupAuth();

  var msg = {
    user : repo.user,
    repo : repo.name,
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

module.exports = exports = new GithubConnector();
