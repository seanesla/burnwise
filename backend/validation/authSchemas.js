/**
 * Authentication Validation Schemas
 * Comprehensive input validation using Joi
 * SECURITY: Prevents injection and malformed data attacks
 */

const Joi = require('joi');

/**
 * Login validation schema
 */
const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .max(255)
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.empty': 'Email is required',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .min(6)
    .max(128)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters',
      'string.max': 'Password is too long',
      'string.empty': 'Password is required',
      'any.required': 'Password is required'
    })
}).options({ stripUnknown: true });

/**
 * Registration validation schema
 */
const registrationSchema = Joi.object({
  farm_name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .pattern(/^[a-zA-Z0-9\s\-.']+$/)
    .messages({
      'string.pattern.base': 'Farm name contains invalid characters',
      'string.min': 'Farm name must be at least 2 characters',
      'string.max': 'Farm name is too long',
      'string.empty': 'Farm name is required',
      'any.required': 'Farm name is required'
    }),
  owner_name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .pattern(/^[a-zA-Z\s\-.']+$/)
    .messages({
      'string.pattern.base': 'Owner name contains invalid characters',
      'string.min': 'Owner name must be at least 2 characters',
      'string.max': 'Owner name is too long',
      'string.empty': 'Owner name is required',
      'any.required': 'Owner name is required'
    }),
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .max(255)
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.empty': 'Email is required',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .min(8)
    .max(128)
    .required()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      'string.min': 'Password must be at least 8 characters',
      'string.max': 'Password is too long',
      'string.empty': 'Password is required',
      'any.required': 'Password is required'
    }),
  phone: Joi.string()
    .trim()
    .pattern(/^[\d\s\-+()]+$/)
    .min(10)
    .max(20)
    .allow(null, '')
    .messages({
      'string.pattern.base': 'Phone number contains invalid characters'
    }),
  longitude: Joi.number()
    .min(-180)
    .max(180)
    .precision(6)
    .allow(null)
    .messages({
      'number.min': 'Invalid longitude',
      'number.max': 'Invalid longitude'
    }),
  latitude: Joi.number()
    .min(-90)
    .max(90)
    .precision(6)
    .allow(null)
    .messages({
      'number.min': 'Invalid latitude',
      'number.max': 'Invalid latitude'
    }),
  total_acreage: Joi.number()
    .positive()
    .max(1000000)
    .allow(null)
    .messages({
      'number.positive': 'Acreage must be positive',
      'number.max': 'Acreage value is too large'
    })
}).options({ stripUnknown: true });

/**
 * Password reset request schema
 */
const passwordResetRequestSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .max(255)
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.empty': 'Email is required',
      'any.required': 'Email is required'
    })
}).options({ stripUnknown: true });

/**
 * Password reset confirmation schema
 */
const passwordResetSchema = Joi.object({
  token: Joi.string()
    .length(64)
    .hex()
    .required()
    .messages({
      'string.length': 'Invalid reset token',
      'string.hex': 'Invalid reset token format',
      'any.required': 'Reset token is required'
    }),
  newPassword: Joi.string()
    .min(8)
    .max(128)
    .required()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      'string.min': 'Password must be at least 8 characters',
      'string.max': 'Password is too long',
      'string.empty': 'New password is required',
      'any.required': 'New password is required'
    })
}).options({ stripUnknown: true });

/**
 * Profile update schema
 */
const profileUpdateSchema = Joi.object({
  owner_name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .pattern(/^[a-zA-Z\s\-.']+$/)
    .messages({
      'string.pattern.base': 'Name contains invalid characters',
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name is too long'
    }),
  phone: Joi.string()
    .trim()
    .pattern(/^[\d\s\-+()]+$/)
    .min(10)
    .max(20)
    .allow(null, '')
    .messages({
      'string.pattern.base': 'Phone number contains invalid characters'
    }),
  total_acreage: Joi.number()
    .positive()
    .max(1000000)
    .messages({
      'number.positive': 'Acreage must be positive',
      'number.max': 'Acreage value is too large'
    })
}).min(1).options({ stripUnknown: true });

/**
 * Validate and sanitize input
 */
const validateInput = (schema, data) => {
  const { error, value } = schema.validate(data);
  
  if (error) {
    // Extract first error message
    const message = error.details[0].message;
    return {
      isValid: false,
      error: message,
      value: null
    };
  }
  
  return {
    isValid: true,
    error: null,
    value
  };
};

module.exports = {
  loginSchema,
  registrationSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  profileUpdateSchema,
  validateInput
};