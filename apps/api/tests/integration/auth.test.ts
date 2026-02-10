import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, cleanDatabase, createTestUserWithOrg } from '../helpers/test-app';

describe('Auth API', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'new@test.com', password: 'password123', firstName: 'New', lastName: 'User' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe('new@test.com');
      expect(res.body.data.organisation).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'dup@test.com', password: 'password123', firstName: 'A', lastName: 'B' });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'dup@test.com', password: 'password123', firstName: 'C', lastName: 'D' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'notanemail', password: 'password123', firstName: 'A', lastName: 'B' });

      expect(res.status).toBe(400);
    });

    it('should reject short password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'a@test.com', password: 'short', firstName: 'A', lastName: 'B' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      // Register first
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'login@test.com', password: 'password123', firstName: 'Login', lastName: 'User' });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'login@test.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('should reject wrong password', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'wrong@test.com', password: 'password123', firstName: 'A', lastName: 'B' });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'wrong@test.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
    });

    it('should reject non-existent email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'password123' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return user profile with valid token', async () => {
      const { token } = await createTestUserWithOrg();
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBeDefined();
    });

    it('should reject without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should always return 200 regardless of email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'doesntexist@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return reset token in dev mode', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'reset@test.com', password: 'password123', firstName: 'A', lastName: 'B' });

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'reset@test.com' });

      expect(res.body.data.token).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'rp@test.com', password: 'password123', firstName: 'A', lastName: 'B' });

      const forgot = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'rp@test.com' });

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: forgot.body.data.token, password: 'newpassword123' });

      expect(res.status).toBe(200);

      // Login with new password
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'rp@test.com', password: 'newpassword123' });

      expect(login.status).toBe(200);
    });

    it('should reject used token', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'rp2@test.com', password: 'password123', firstName: 'A', lastName: 'B' });

      const forgot = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'rp2@test.com' });

      await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: forgot.body.data.token, password: 'newpassword123' });

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: forgot.body.data.token, password: 'anotherpassword' });

      expect(res.status).toBe(400);
    });
  });
});
