const { body } = require('express-validator');

// Updated validation to make dates optional:
body('start_date').optional({ nullable: true, checkFalsy: true }).isDate().withMessage('Start date must be a valid date'),
body('end_date').optional({ nullable: true, checkFalsy: true }).isDate().withMessage('End date must be a valid date') 