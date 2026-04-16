import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Helper to get initial data (same as store defaults)
const getInitialData = () => {
  return {
    items: [
      { id: '1', name: 'Burger',   price: 45, category: 'Food' },
      { id: '2', name: 'Pizza',    price: 80, category: 'Food' },
      { id: '3', name: 'Shawarma', price: 35, category: 'Food' },
      { id: '4', name: 'Fries',    price: 20, category: 'Sides' },
      { id: '5', name: 'Cola',     price: 15, category: 'Drinks' },
      { id: '6', name: 'Water',    price: 8,  category: 'Drinks' },
      { id: '7', name: 'Juice',    price: 18, category: 'Drinks' },
    ],
    categories: ['Food', 'Drinks', 'Sides'],
    deliveryMen: [
      { id: 'd1', name: 'Ahmed Hassan' },
      { id: 'd2', name: 'Mohamed Ali' },
    ],
    orders: [],
    credentials: [],
    history: [],
    settings: {
      showpass: false,
      confirmdelete: true,
      rowsperpage: 25,
      historyretention: 30,
      historylimit: 200,
      theme: 'light',
    },
  };
};

export async function GET() {
  try {
    let vault = await prisma.vault.findUnique({
      where: { id: 1 },
    });

    if (!vault) {
      const initial = getInitialData();
      vault = await prisma.vault.create({
        data: {
          id: 1,
          data: initial as any,
        },
      });
    }

    return NextResponse.json(vault.data);
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Failed to read data from Supabase' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    await prisma.vault.upsert({
      where: { id: 1 },
      update: { data: body },
      create: { id: 1, data: body },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Failed to save data to Supabase' }, { status: 500 });
  }
}
