
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var issueSchema = new Schema({
  url : String,
  id : Number,
  number : Number,
  title : String,
  user : { login : String, id : Number },
  state : String,
  assignee : { login : String, id : Number },
  comments : Number,
  created_at : Date,
  updated_at : Date,
  closed_at : Date,
  body : String,
  repo : { user : String, name : String }
}, { _id : false });

issueSchema.index({ repo : 1, 'assignee.login' : 1 });

module.exports.Issue = exports.Issue = mongoose.model('Issue', issueSchema);

var commentSchema = new Schema({
  url : String,
  id : Number,
  user : { login : String, id : Number },
  created_at : Date,
  updated_at : Date,
  body : String,
  issue : {
    id : Number,
    number : Number,
    repo : { name : String, user : String }
  }
}, { _id : false });

module.exports.Comment = exports.Comment = mongoose.model('Comment', commentSchema);
