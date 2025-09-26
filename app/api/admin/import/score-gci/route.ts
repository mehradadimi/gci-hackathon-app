import { NextResponse } from 'next/server';
import { computeScores } from '@/src/server/score';

export async function POST() {
  const rows = await computeScores();
  return NextResponse.json({ ok: true, rows });
}


