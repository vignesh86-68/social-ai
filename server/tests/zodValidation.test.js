const express = require('express');
const request = require('supertest');
const { z } = require('zod');
const validate = require('../src/middleware/validate');
const {
  registerSchema,
  loginSchema,
} = require('../src/validators/authValidators');
const {
  createPostSchema,
  signalHistorySchema,
  signalPostSchema,
} = require('../src/validators/postValidators');
const errorHandler = require('../src/middleware/errorHandler');

const validationApp = express();
validationApp.use(express.json());
validationApp.post('/register', validate(registerSchema), (req, res) => res.json(req.body));
validationApp.post('/post', validate(createPostSchema), (req, res) => res.json(req.body));
validationApp.get('/history', validate(signalHistorySchema), (req, res) => res.json(req.body));
validationApp.post('/signal', validate(signalPostSchema), (req, res) => res.json(req.body));
validationApp.use(errorHandler);

describe('Zod validation contracts', () => {
  it('rejects missing and invalid required authentication fields consistently', async () => {
    const response = await request(validationApp).post('/register').send({
      username: 'ab',
      email: 'not-an-email',
      password: 'weak',
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({ field: 'username' }),
          expect.objectContaining({ field: 'email' }),
          expect.objectContaining({ field: 'password' }),
        ]),
      })
    );
  });

  it('preserves optional fields and pagination defaults', async () => {
    const register = await request(validationApp).post('/register').send({
      username: 'valid_user',
      email: 'valid@example.com',
      password: 'Password123',
    });
    const history = await request(validationApp).get('/history');

    expect(register.status).toBe(200);
    expect(register.body.displayName).toBeUndefined();
    expect(history.status).toBe(200);
    expect(history.body).toEqual({ page: 1, limit: 20 });
  });

  it('rejects invalid array-like input and oversized AI evidence arrays', () => {
    const invalid = z.object({
      evidence: z.array(z.object({ commentIds: z.array(z.string()).max(20) })).max(2),
    });

    expect(invalid.safeParse({ evidence: 'not-an-array' }).success).toBe(false);
    expect(
      invalid.safeParse({
        evidence: Array.from({ length: 3 }, () => ({ commentIds: [] })),
      }).success
    ).toBe(false);
    expect(
      invalid.safeParse({
        evidence: [{ commentIds: Array.from({ length: 21 }, () => 'comment') }],
      }).success
    ).toBe(false);
  });

  it('validates objects and records with explicit key and value types', () => {
    const metadataSchema = z.object({
      labels: z.record(z.string(), z.string()),
      enabled: z.boolean(),
    });

    expect(
      metadataSchema.safeParse({
        labels: { source: 'user', category: 'social' },
        enabled: true,
      }).success
    ).toBe(true);
    expect(
      metadataSchema.safeParse({
        labels: { source: 123 },
        enabled: 'yes',
      }).success
    ).toBe(false);
  });

  it('preserves post and Signal request validation rules', async () => {
    const invalidPost = await request(validationApp).post('/post').send({ content: '' });
    const invalidSignal = await request(validationApp).post('/signal').send({
      postId: 'invalid-id',
    });
    const validSignal = await request(validationApp).post('/signal').send({
      postId: '507f1f77bcf86cd799439011',
    });

    expect(invalidPost.status).toBe(400);
    expect(invalidSignal.status).toBe(400);
    expect(validSignal.status).toBe(200);
    expect(validSignal.body).toEqual({
      postId: '507f1f77bcf86cd799439011',
      save: false,
    });
  });

  it('rejects invalid login credentials before controller execution', async () => {
    const response = await request(validationApp).post('/register').send({
      username: 'valid_user',
      email: 'valid@example.com',
      password: 'Password123',
    });
    const loginSchemaApp = express();
    loginSchemaApp.use(express.json());
    loginSchemaApp.post('/login', validate(loginSchema), (req, res) => res.json(req.body));
    loginSchemaApp.use(errorHandler);
    const login = await request(loginSchemaApp).post('/login').send({ email: 'bad' });

    expect(response.status).toBe(200);
    expect(login.status).toBe(400);
    expect(login.body).toEqual(
      expect.objectContaining({
        success: false,
        message: 'Validation failed',
        errors: expect.any(Array),
      })
    );
  });
});
