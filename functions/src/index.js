const { onTodoWrite } = require('./todoBountyTrigger');
const { onHabitLogWrite } = require('./habitBountyTrigger');

module.exports = {
  onTodoWrite,
  onHabitLogWrite
};
