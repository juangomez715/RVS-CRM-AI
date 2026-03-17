import prisma from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: trackingId } = await params;
        const { searchParams } = new URL(request.url);
        const targetUrl = searchParams.get('url');

        // 1. Mark as clicked in the database
        if (trackingId) {
            // We also mark as read if they clicked without loading images
            await prisma.interaction.updateMany({
                where: { trackingId },
                data: {
                    clickedAt: new Date(),
                    readAt: new Date() // Fallback assumption
                }
            });
        }

        // 2. Redirect to the original URL or a fallback
        if (targetUrl) {
            return NextResponse.redirect(targetUrl);
        } else {
            // Fallback if no URL provided
            return NextResponse.redirect(new URL('/', request.url));
        }

    } catch (error) {
        console.error("Tracking Click Error:", error);
        // Try to redirect anyway if URL exists
        const { searchParams } = new URL(request.url);
        const targetUrl = searchParams.get('url');
        if (targetUrl) {
            return NextResponse.redirect(targetUrl);
        }
        return NextResponse.redirect(new URL('/', request.url));
    }
}
