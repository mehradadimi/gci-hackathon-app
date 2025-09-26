import { NextResponse } from 'next/server';
import { downloadCompanyTickers } from '@/src/server/cik';

export async function POST() {
  await downloadCompanyTickers(true);
  return NextResponse.json({ ok: true });
}


