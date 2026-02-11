import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import app from '../../src/app';
import { initSignaling } from '../../src/signaling';
import { cleanDatabase, createTestUserWithOrg, createTestVesselWithComponents, createTestWorkOrder } from '../helpers/test-app';
import prisma from '../../src/config/database';
import { generateAccessToken } from '../../src/config/auth';
import { workFormService } from '../../src/services/work-form.service';

let httpServer: http.Server;
let serverPort: number;
let signalingResult: ReturnType<typeof initSignaling>;

function createClient(token: string): ClientSocket {
  return ioClient(`http://localhost:${serverPort}`, {
    path: '/socket.io',
    auth: { token },
    transports: ['polling'],
    forceNew: true,
  });
}

function waitForEvent(socket: ClientSocket, event: string, timeout = 3000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeout);
    socket.once(event, (data: any) => { clearTimeout(timer); resolve(data); });
  });
}

describe('Real-time Collaboration', () => {
  let tokenA: string;
  let tokenB: string;
  let userA: any;
  let userB: any;
  let orgId: string;
  let workOrderId: string;
  let entryIds: string[];

  beforeEach(async () => {
    await cleanDatabase();

    // Start HTTP server with signaling
    httpServer = http.createServer(app);
    signalingResult = initSignaling(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    serverPort = (httpServer.address() as any).port;

    // Create two users in the same org
    const ctxA = await createTestUserWithOrg();
    orgId = ctxA.org.id;
    userA = ctxA.user;
    tokenA = ctxA.token;

    const bcrypt = await import('bcryptjs');
    const pwHash = await bcrypt.hash('test', 10);
    userB = await prisma.user.create({ data: { email: `userb-${Date.now()}@test.com`, passwordHash: pwHash, firstName: 'User', lastName: 'B' } });
    await prisma.organisationUser.create({
      data: { userId: userB.id, organisationId: orgId, role: 'OPERATOR', permissions: JSON.stringify(['VESSEL_VIEW', 'WORK_ORDER_VIEW', 'WORK_ORDER_EDIT', 'INSPECTION_VIEW']) },
    });
    tokenB = generateAccessToken({ userId: userB.id, email: userB.email, organisationId: orgId, role: 'OPERATOR', permissions: ['VESSEL_VIEW', 'WORK_ORDER_VIEW', 'WORK_ORDER_EDIT', 'INSPECTION_VIEW'] });

    // Create vessel, components, work order, form
    const { vessel } = await createTestVesselWithComponents(orgId);
    const wo = await createTestWorkOrder(vessel.id, orgId);
    workOrderId = wo.id;
    const entries = await workFormService.generateForm(workOrderId, userA.id);
    entryIds = entries.map((e) => e.id);
  });

  afterEach(async () => {
    // Force close all socket.io connections before closing the server
    if (signalingResult?.io) {
      signalingResult.io.close();
    }
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
      // Force close if it doesn't close in 2s
      setTimeout(resolve, 2000);
    });
  });

  it('should allow a user to lock a field', async () => {
    const clientA = createClient(tokenA);
    await waitForEvent(clientA, 'connect');

    clientA.emit('form:join', { workOrderId });
    await new Promise((r) => setTimeout(r, 100));

    const lockPromise = waitForEvent(clientA, 'form:locked');
    clientA.emit('form:lock', { workOrderId, entryId: entryIds[0], field: 'condition' });
    const lockData = await lockPromise;

    expect(lockData.entryId).toBe(entryIds[0]);
    expect(lockData.field).toBe('condition');
    expect(lockData.userId).toBe(userA.id);

    clientA.disconnect();
  });

  it('should deny field lock when same field is locked by another user', async () => {
    const clientA = createClient(tokenA);
    const clientB = createClient(tokenB);

    await Promise.all([waitForEvent(clientA, 'connect'), waitForEvent(clientB, 'connect')]);

    clientA.emit('form:join', { workOrderId });
    clientB.emit('form:join', { workOrderId });
    await new Promise((r) => setTimeout(r, 100));

    // A locks the condition field
    const lockPromiseA = waitForEvent(clientA, 'form:locked');
    clientA.emit('form:lock', { workOrderId, entryId: entryIds[0], field: 'condition' });
    await lockPromiseA;

    // B tries to lock the same field on the same entry
    const denyPromise = waitForEvent(clientB, 'form:lock-denied');
    clientB.emit('form:lock', { workOrderId, entryId: entryIds[0], field: 'condition' });
    const denyData = await denyPromise;

    expect(denyData.entryId).toBe(entryIds[0]);
    expect(denyData.field).toBe('condition');
    expect(denyData.lockedBy.userId).toBe(userA.id);

    // But B CAN lock a different field on the same entry
    const lockPromiseB = waitForEvent(clientB, 'form:locked');
    clientB.emit('form:lock', { workOrderId, entryId: entryIds[0], field: 'notes' });
    const lockB = await lockPromiseB;
    expect(lockB.field).toBe('notes');

    clientA.disconnect();
    clientB.disconnect();
  });

  it('should auto-release field locks on disconnect', async () => {
    const clientA = createClient(tokenA);
    const clientB = createClient(tokenB);

    await Promise.all([waitForEvent(clientA, 'connect'), waitForEvent(clientB, 'connect')]);

    clientA.emit('form:join', { workOrderId });
    clientB.emit('form:join', { workOrderId });
    await new Promise((r) => setTimeout(r, 100));

    // A locks a field
    const lockPromise = waitForEvent(clientB, 'form:locked');
    clientA.emit('form:lock', { workOrderId, entryId: entryIds[0], field: 'condition' });
    await lockPromise;

    // A disconnects - B should see unlock with field info
    const unlockPromise = waitForEvent(clientB, 'form:unlocked');
    clientA.disconnect();
    const unlockData = await unlockPromise;

    expect(unlockData.entryId).toBe(entryIds[0]);
    expect(unlockData.field).toBe('condition');

    clientB.disconnect();
  });

  it('should persist field updates to database and broadcast', async () => {
    const clientA = createClient(tokenA);
    const clientB = createClient(tokenB);

    await Promise.all([waitForEvent(clientA, 'connect'), waitForEvent(clientB, 'connect')]);

    clientA.emit('form:join', { workOrderId });
    clientB.emit('form:join', { workOrderId });
    await new Promise((r) => setTimeout(r, 100));

    // A updates a field
    const updatePromise = waitForEvent(clientB, 'form:updated');
    clientA.emit('form:update', { workOrderId, entryId: entryIds[0], field: 'condition', value: 'GOOD' });
    const updateData = await updatePromise;

    expect(updateData.entryId).toBe(entryIds[0]);
    expect(updateData.field).toBe('condition');
    expect(updateData.value).toBe('GOOD');

    // Verify DB persistence
    const dbEntry = await prisma.workFormEntry.findUnique({ where: { id: entryIds[0] } });
    expect(dbEntry?.condition).toBe('GOOD');

    clientA.disconnect();
    clientB.disconnect();
  });

  it('should persist screenshot to database and broadcast to all', async () => {
    const clientA = createClient(tokenA);
    const clientB = createClient(tokenB);

    await Promise.all([waitForEvent(clientA, 'connect'), waitForEvent(clientB, 'connect')]);

    clientA.emit('form:join', { workOrderId });
    clientB.emit('form:join', { workOrderId });
    await new Promise((r) => setTimeout(r, 100));

    // A adds a screenshot
    const screenshotPromiseB = waitForEvent(clientB, 'form:screenshot-added');
    const screenshotPromiseA = waitForEvent(clientA, 'form:screenshot-added');
    clientA.emit('form:screenshot', { workOrderId, entryId: entryIds[0], dataUrl: 'data:image/jpeg;base64,fakedata123' });

    const [dataA, dataB] = await Promise.all([screenshotPromiseA, screenshotPromiseB]);

    expect(dataA.entryId).toBe(entryIds[0]);
    expect(dataB.entryId).toBe(entryIds[0]);

    // Verify DB
    const dbEntry = await prisma.workFormEntry.findUnique({ where: { id: entryIds[0] } });
    const atts = JSON.parse(dbEntry?.attachments || '[]');
    expect(atts).toContain('data:image/jpeg;base64,fakedata123');

    clientA.disconnect();
    clientB.disconnect();
  });

  it('should handle mark-complete and clear field locks', async () => {
    const clientA = createClient(tokenA);
    const clientB = createClient(tokenB);

    await Promise.all([waitForEvent(clientA, 'connect'), waitForEvent(clientB, 'connect')]);

    clientA.emit('form:join', { workOrderId });
    clientB.emit('form:join', { workOrderId });
    await new Promise((r) => setTimeout(r, 100));

    // A locks a field and completes the entry
    clientA.emit('form:lock', { workOrderId, entryId: entryIds[0], field: 'condition' });
    await waitForEvent(clientA, 'form:locked');

    const completePromise = waitForEvent(clientB, 'form:completed');
    clientA.emit('form:complete', { workOrderId, entryId: entryIds[0] });
    const completeData = await completePromise;

    expect(completeData.entryId).toBe(entryIds[0]);

    // Verify DB
    const dbEntry = await prisma.workFormEntry.findUnique({ where: { id: entryIds[0] } });
    expect(dbEntry?.status).toBe('COMPLETED');
    expect(dbEntry?.completedAt).toBeTruthy();

    clientA.disconnect();
    clientB.disconnect();
  });

  it('should allow two users to edit different entries simultaneously', async () => {
    const clientA = createClient(tokenA);
    const clientB = createClient(tokenB);

    await Promise.all([waitForEvent(clientA, 'connect'), waitForEvent(clientB, 'connect')]);

    clientA.emit('form:join', { workOrderId });
    clientB.emit('form:join', { workOrderId });
    await new Promise((r) => setTimeout(r, 100));

    // A locks entry 0, B locks entry 1
    clientA.emit('form:lock', { workOrderId, entryId: entryIds[0] });
    clientB.emit('form:lock', { workOrderId, entryId: entryIds[1] });

    await Promise.all([
      waitForEvent(clientA, 'form:locked'),
      waitForEvent(clientB, 'form:locked'),
    ]);

    // Both update their respective entries
    const updateB = waitForEvent(clientB, 'form:updated');
    const updateA = waitForEvent(clientA, 'form:updated');

    clientA.emit('form:update', { workOrderId, entryId: entryIds[0], field: 'condition', value: 'POOR' });
    clientB.emit('form:update', { workOrderId, entryId: entryIds[1], field: 'condition', value: 'GOOD' });

    const [fromA, fromB] = await Promise.all([updateB, updateA]);

    // B sees A's update on entry 0
    expect(fromA.entryId).toBe(entryIds[0]);
    expect(fromA.value).toBe('POOR');

    // A sees B's update on entry 1
    expect(fromB.entryId).toBe(entryIds[1]);
    expect(fromB.value).toBe('GOOD');

    // Verify both in DB
    const db0 = await prisma.workFormEntry.findUnique({ where: { id: entryIds[0] } });
    const db1 = await prisma.workFormEntry.findUnique({ where: { id: entryIds[1] } });
    expect(db0?.condition).toBe('POOR');
    expect(db1?.condition).toBe('GOOD');

    clientA.disconnect();
    clientB.disconnect();
  });

  it('should publish video room state and peer join events for call setup', async () => {
    const clientA = createClient(tokenA);
    const clientB = createClient(tokenB);

    await Promise.all([waitForEvent(clientA, 'connect'), waitForEvent(clientB, 'connect')]);

    const stateA = waitForEvent(clientA, 'room:state');
    const countA1 = waitForEvent(clientA, 'room:count');
    clientA.emit('room:join', { workOrderId });

    const [roomStateA, roomCountA1] = await Promise.all([stateA, countA1]);
    expect(roomStateA.participants).toEqual([]);
    expect(roomStateA.count).toBe(1);
    expect(roomCountA1.count).toBe(1);

    const peerJoinedA = waitForEvent(clientA, 'peer:joined');
    const stateB = waitForEvent(clientB, 'room:state');
    const countA2 = waitForEvent(clientA, 'room:count');
    const countB2 = waitForEvent(clientB, 'room:count');
    clientB.emit('room:join', { workOrderId });

    const [joinedEvent, roomStateB, roomCountA2, roomCountB2] = await Promise.all([peerJoinedA, stateB, countA2, countB2]);
    expect(joinedEvent.socketId).toBe(clientB.id);
    expect(roomStateB.participants).toHaveLength(1);
    expect(roomStateB.participants[0].socketId).toBe(clientA.id);
    expect(roomStateB.count).toBe(2);
    expect(roomCountA2.count).toBe(2);
    expect(roomCountB2.count).toBe(2);

    clientA.disconnect();
    clientB.disconnect();
  });

  it('should relay offer, answer, and ICE candidate events to target peer', async () => {
    const clientA = createClient(tokenA);
    const clientB = createClient(tokenB);

    await Promise.all([waitForEvent(clientA, 'connect'), waitForEvent(clientB, 'connect')]);
    clientA.emit('room:join', { workOrderId });
    clientB.emit('room:join', { workOrderId });
    await Promise.all([waitForEvent(clientA, 'room:count'), waitForEvent(clientB, 'room:count')]);

    const fakeOffer = { type: 'offer', sdp: 'fake-offer-sdp' };
    const fakeAnswer = { type: 'answer', sdp: 'fake-answer-sdp' };
    const fakeIce = { candidate: 'candidate:1 1 udp 1 127.0.0.1 12345 typ host', sdpMid: '0', sdpMLineIndex: 0 };

    const offerAtB = waitForEvent(clientB, 'signal:offer');
    clientA.emit('signal:offer', { targetSocketId: clientB.id, offer: fakeOffer });
    const receivedOffer = await offerAtB;
    expect(receivedOffer.fromSocketId).toBe(clientA.id);
    expect(receivedOffer.offer).toEqual(fakeOffer);

    const answerAtA = waitForEvent(clientA, 'signal:answer');
    clientB.emit('signal:answer', { targetSocketId: clientA.id, answer: fakeAnswer });
    const receivedAnswer = await answerAtA;
    expect(receivedAnswer.fromSocketId).toBe(clientB.id);
    expect(receivedAnswer.answer).toEqual(fakeAnswer);

    const iceAtA = waitForEvent(clientA, 'signal:ice-candidate');
    clientB.emit('signal:ice-candidate', { targetSocketId: clientA.id, candidate: fakeIce });
    const receivedIce = await iceAtA;
    expect(receivedIce.fromSocketId).toBe(clientB.id);
    expect(receivedIce.candidate).toEqual(fakeIce);

    clientA.disconnect();
    clientB.disconnect();
  });

  it('should broadcast room count to form listeners when video call starts', async () => {
    const formClient = createClient(tokenA);
    const callClient = createClient(tokenB);

    await Promise.all([waitForEvent(formClient, 'connect'), waitForEvent(callClient, 'connect')]);

    formClient.emit('form:join', { workOrderId });
    await new Promise((r) => setTimeout(r, 100));

    const countAtForm = waitForEvent(formClient, 'room:count');
    callClient.emit('room:join', { workOrderId });

    const roomCount = await countAtForm;
    expect(roomCount.workOrderId).toBe(workOrderId);
    expect(roomCount.count).toBe(1);

    formClient.disconnect();
    callClient.disconnect();
  });
});
