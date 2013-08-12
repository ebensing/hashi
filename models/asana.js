
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var workspaceSchema = new Schema({
  id : Number,
  name : String,
  is_organization : Boolean
});

module.exports.Workspace = exports.Workspace = mongoose.model('Workspace', workspaceSchema);

var projectSchema = new Schema({
  id : Number,
  archived : Boolean,
  created_at : Date,
  modified_at : Date,
  name : String,
  notes : String,
  workspace : { id : Number, name : String },
  team : { id : Number, name : String }
});

module.exports.Project = exports.Project = mongoose.model('Project', projectSchema);

var taskSchema = new Schema({
  id : Number,
  assignee : { id : Number, name : String },
  assignee_status : String,
  created_at : Date,
  completed : Boolean,
  completed_at : Date,
  due_on : Date,
  modified_at : Date,
  name : String,
  notes : String,
  projects : [{ id : Number, name : String }],
  parent : { id : Number, name : String },
  workspace : { id : Number, name : String}
});

module.exports.Task = exports.Task = mongoose.model('Task', taskSchema);

var storySchema = new Schema({
  id : Number,
  created_at : Date,
  text : String,
  target : { id : Number, name : String },
  source : String,
  type : String
});

module.exports.Story = exports.Story = mongoose.model('Story', storySchema);
