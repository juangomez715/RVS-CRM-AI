import prisma from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: trackingId } = await params;

        // 1. Mark as read in the database if it exists
        if (trackingId) {
            await prisma.interaction.updateMany({
                where: { trackingId, readAt: null },
                data: { readAt: new Date() }
            });
        }

        // 2. Return a 1x1 transparent GIF tracking pixel
        const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

        return new NextResponse(pixel, {
            status: 200,
            headers: {
                'Content-Type': 'image/gif',
                'Cache-Control': 'no-store, max-age=0',
            },
        });

    } catch (error) {
        // Fail silently returning the pixel anyway so the email doesn't show a broken image
        console.error("Tracking Open Error:", error);
        const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        return new NextResponse(pixel, {
            status: 200,
            headers: {
                'Content-Type': 'image/gif',
                'Cache-Control': 'no-store, max-age=0',
            },
        });
    }
}
