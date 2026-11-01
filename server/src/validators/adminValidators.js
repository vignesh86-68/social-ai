const { z } = require('zod');

const adminInvitationSchema = z.object({
  email: z.string().email('Please enter a valid invitation email address'),
});

const acceptAdminInvitationSchema = z.object({
  token: z.string().min(64, 'Invitation token is required'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number'),
  displayName: z.string().max(50).optional(),
});

module.exports = { adminInvitationSchema, acceptAdminInvitationSchema };
