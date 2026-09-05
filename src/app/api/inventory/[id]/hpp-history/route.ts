import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  return NextResponse.json({ success: true, data: [], items: [] });
}
export async function POST(request: Request) {
  return NextResponse.json({ success: true, data: [] });
}
export async function PUT(request: Request) {
  return NextResponse.json({ success: true, data: [] });
}
export async function DELETE(request: Request) {
  return NextResponse.json({ success: true });
}
