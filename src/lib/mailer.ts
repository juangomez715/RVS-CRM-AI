import nodemailer from 'nodemailer';
import prisma from './db';
import { sendViaGmail, getConnectedGmailAccount } from './gmail';
import { decrypt } from './crypto';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Main entry point — auto-routes to Gmail API or SMTP depending on active integration
export async function sendEmail(to: string, subject: string, html: string, trackingId?: string) {
    const gmail = await getConnectedGmailAccount();
    if (gmail) {
        // Apply humanized delay even for Gmail API sends
        const delay = Math.floor(Math.random() * (4000 - 1500 + 1)) + 1500;
        await wait(delay);
        return sendViaGmail(to, subject, html, trackingId);
    }
    return sendEmailWithShield(to, subject, html, trackingId);
}

export async function sendEmailWithShield(to: string, subject: string, html: string, trackingId?: string) {
    // 1. Fetch Integration Settings for SMTP
    const smtpIntegration = await prisma.integration.findFirst({
        where: { provider: 'smtp', isActive: true }
    });

    if (!smtpIntegration || !smtpIntegration.metadata) {
        throw new Error("SMTP Mail Provider is not configured or connected securely.");
    }

    let meta: any = {};
    try {
        meta = JSON.parse(smtpIntegration.metadata);
    } catch (e) {
        throw new Error("Invalid SMTP configuration in vault.");
    }

    const dailyLimit = meta.dailyLimit || 150;
    const delayMin = meta.delayMin || 3;
    const delayMax = meta.delayMax || 7;
    const warmingActive = meta.warmingActive ?? true;

    // 2. DELIVERABILITY SHIELD: Daily Send Limit Check
    // Get count of emails sent today by the human origin vs AI origin to enforce limits
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sentToday = await prisma.interaction.count({
        where: {
            channel: 'Email',
            sender: { in: ['AI', 'HUMAN', 'AUTOMATION'] }, // Only outbound
            createdAt: { gte: today }
        }
    });

    if (sentToday >= dailyLimit) {
        console.warn(`Deliverability Shield blocked send: Daily limit of ${dailyLimit} reached. Set by Admin.`);
        throw new Error("Deliverability Shield triggered: Daily sending limit reached to protect domain reputation.");
    }

    // 3. HUMAN RANDOMIZED DELAY
    // Calculate realistic delays to avoid being flagged by provider throttles
    const sandboxDelay = Math.floor(Math.random() * (4000 - 1500 + 1)) + 1500;
    console.log(`[Anti-Spam Shield] Random Humanizing Pause: Waiting ${sandboxDelay}ms before sending email to ${to}...`);
    await wait(sandboxDelay);

    // 4. Transport Logic - REAL CONFIGURATION
    // Decrypt password — supports both legacy plaintext and new encrypted format
    let smtpPassword: string;
    if (meta.encryptedPassword) {
        smtpPassword = decrypt(meta.encryptedPassword);
    } else if (meta.password) {
        smtpPassword = meta.password; // legacy plaintext fallback
    } else {
        throw new Error('SMTP password not found in configuration.');
    }

    const transporter = nodemailer.createTransport({
        host: meta.host,
        port: Number(meta.port),
        secure: meta.secure,
        auth: {
            user: meta.username,
            pass: smtpPassword,
        }
    });

    // We inject the tracking pixel implicitly to the body if trackingId is present
    let finalHtml = html;
    if (trackingId) {
        const trackingUrl = `${process.env.APP_URL || 'http://localhost:3000'}/api/track/open/${trackingId}`;
        const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none; visibility:hidden; opacity:0; color:transparent;" alt="" />`;
        finalHtml += trackingPixel;
    }

    try {
        const info = await transporter.sendMail({
            from: `"RVS Intelligence CRM" <${meta.username}>`,
            to,
            subject,
            html: finalHtml
        });

        console.log(`[Deliverability] Successfully dispatched to ${to} via ${meta.host}. MessageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId };

    } catch (error) {
        console.error("[Deliverability Error] Mail sending failed:", error);
        throw new Error("SMTP Transport failed. Verify your App Passwords and Port credentials.");
    }
}
