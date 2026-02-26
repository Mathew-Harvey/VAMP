/**
 * Sync Rise-X asset-rows API data into VAMP vessels table.
 *
 * Prerequisites:
 * - DATABASE_URL set (same as API, e.g. Render Postgres)
 * - RISE_X_API_URL (e.g. https://api-test.rise-x.io)
 * - RISE_X_API_KEY or Authorization header token for Rise-X
 * - FLEET_ORG_ID optional; if not set, script will create "Rise-X Fleet" org and use it
 *
 * Run from repo root: npx tsx apps/api/scripts/sync-rise-x.ts
 * Or from apps/api: npx tsx scripts/sync-rise-x.ts
 */

import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const RISE_X_API_URL = (process.env.RISE_X_API_URL || '').replace(/\/+$/, '');
const RISE_X_API_KEY = process.env.RISE_X_API_KEY || process.env.RISE_X_BEARER_TOKEN || '';
const FLEET_ORG_ID = process.env.FLEET_ORG_ID || '';
const PAYLOAD_PATH = fs.existsSync(path.resolve(process.cwd(), 'thirdPartyAPI/asset-rows-request-without-filter.json'))
  ? path.resolve(process.cwd(), 'thirdPartyAPI/asset-rows-request-without-filter.json')
  : path.resolve(process.cwd(), '../../thirdPartyAPI/asset-rows-request-without-filter.json');
const TAKE = 100;

type RiseXRow = {
  id?: string;
  data?: {
    displayName?: string;
    flag?: string;
    callSign?: string;
    imoNumber?: string;
    mmsi?: string;
    [k: string]: unknown;
  };
  bfmpProperties?: Record<string, unknown>;
  [k: string]: unknown;
};

function loadPayload(): Record<string, unknown> {
  const raw = fs.readFileSync(PAYLOAD_PATH, 'utf-8');
  const payloadStart = raw.indexOf('Payload:');
  if (payloadStart === -1) throw new Error('Payload not found in ' + PAYLOAD_PATH);
  const jsonStart = raw.indexOf('{', payloadStart);
  const jsonStr = raw.slice(jsonStart);
  return JSON.parse(jsonStr) as Record<string, unknown>;
}

function transformRowToVessel(row: RiseXRow, organisationId: string): Record<string, unknown> {
  const data = row.data || {};
  const bfmp = row.bfmpProperties || {};
  const externalId = typeof row.id === 'string' ? row.id : String(row.id ?? '');
  const name = (data.displayName ?? data.name ?? externalId || 'Unknown vessel') as string;

  const metadata: Record<string, unknown> = {};
  if (Object.keys(bfmp).length) metadata.bfmpProperties = bfmp;
  if (data.icon) metadata.icon = data.icon;

  return {
    organisationId,
    externalId: externalId || undefined,
    source: 'RISE_X',
    name,
    imoNumber: (data.imoNumber ?? data.imo ?? undefined) as string | undefined,
    mmsi: (data.mmsi ?? undefined) as string | undefined,
    callSign: (data.callSign ?? undefined) as string | undefined,
    flagState: (data.flag ?? undefined) as string | undefined,
    vesselType: (data.vesselType ?? 'OTHER') as string,
    metadata: Object.keys(metadata).length ? JSON.stringify(metadata) : undefined,
    status: 'ACTIVE',
    complianceStatus: 'COMPLIANT',
    climateZones: '[]',
  };
}

async function fetchAssetRows(
  baseUrl: string,
  auth: string,
  payload: Record<string, unknown>,
  skip: number,
  take: number
): Promise<{ rows: RiseXRow[]; total?: number; hasMore?: boolean }> {
  const url = `${baseUrl}/api/v3/data-grid/asset-rows`;
  const body = { ...payload, skip, take };
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(auth ? { Authorization: auth.startsWith('Bearer ') ? auth : `Bearer ${auth}` } : {}),
  };
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Rise-X API ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { rows?: RiseXRow[]; data?: { rows?: RiseXRow[]; total?: number }; total?: number };
  const rows = data.rows ?? data.data?.rows ?? [];
  const total = data.total ?? data.data?.total;
  return {
    rows,
    total,
    hasMore: total != null ? skip + rows.length < total : rows.length === take,
  };
}

async function main() {
  if (!RISE_X_API_URL) {
    console.error('Set RISE_X_API_URL (e.g. https://api-test.rise-x.io)');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('Set DATABASE_URL (e.g. your Render Postgres URL)');
    process.exit(1);
  }

  const payload = loadPayload();
  payload.take = TAKE;

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  let fleetOrgId = FLEET_ORG_ID;
  if (!fleetOrgId) {
    let org = await prisma.organisation.findFirst({ where: { name: 'Rise-X Fleet' } });
    if (!org) {
      org = await prisma.organisation.create({
        data: { name: 'Rise-X Fleet', type: 'OPERATOR', contactEmail: 'fleet@vamp.local' },
      });
      console.log('Created organisation "Rise-X Fleet" id:', org.id);
      console.log('Add to .env: FLEET_ORG_ID=' + org.id);
    }
    fleetOrgId = org.id;
  }

  let skip = 0;
  let totalSynced = 0;
  const auth = RISE_X_API_KEY;

  console.log('Fetching asset-rows from', RISE_X_API_URL, '...');
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { rows, hasMore } = await fetchAssetRows(RISE_X_API_URL, auth, payload, skip, TAKE);
    if (rows.length === 0) break;

    for (const row of rows) {
      const externalId = typeof row.id === 'string' ? row.id : row.id != null ? String(row.id) : null;
      if (!externalId) continue;
      const vesselData = transformRowToVessel(row, fleetOrgId);
      await prisma.vessel.upsert({
        where: { externalId },
        create: vesselData as any,
        update: vesselData as any,
      });
      totalSynced++;
    }
    console.log('Synced', totalSynced, 'vessels (skip=', skip, ')');
    if (!hasMore) break;
    skip += TAKE;
  }

  console.log('Done. Total vessels synced:', totalSynced);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
