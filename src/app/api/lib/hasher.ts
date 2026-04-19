import crypto from 'node:crypto';

export default function SHA256(content: string) {
    return crypto.createHash('sha256').update(content).digest('hex');
}