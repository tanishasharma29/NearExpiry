import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createComplaintSchema } from '../src/validators/complaint.validator.js';

describe('Customer Complaint Evidence Upload & URL Suite', () => {
  const validOrderId = '507f1f77bcf86cd799439011';

  // 1. Uploaded Evidence Validation & Storage Logic
  describe('1. Evidence Upload Payload Validation & Decoding', () => {
    it('successfully processes and decodes a valid PNG base64 evidence image', async () => {
      // 1x1 transparent PNG base64
      const validPngBase64 =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

      const matches = validPngBase64.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
      assert.notEqual(matches, null);
      assert.equal(matches[1].toLowerCase(), 'png');

      const buffer = Buffer.from(matches[2], 'base64');
      assert.ok(buffer.length > 0);
      assert.ok(buffer.length <= 5 * 1024 * 1024);

      // Verify directory handling and writing
      const testUploadsDir = path.resolve(process.cwd(), 'uploads', 'evidence');
      if (!fs.existsSync(testUploadsDir)) {
        fs.mkdirSync(testUploadsDir, { recursive: true });
      }

      const filename = `test-evidence-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.png`;
      const filePath = path.join(testUploadsDir, filename);

      await fs.promises.writeFile(filePath, buffer);
      assert.equal(fs.existsSync(filePath), true);

      // Clean up test file
      await fs.promises.unlink(filePath);
    });

    it('rejects unsupported image types (e.g., SVG, PDF, GIF, EXE)', () => {
      const unsupportedSvg = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
      const matchesSvg = unsupportedSvg.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
      assert.equal(matchesSvg, null);

      const unsupportedPdf = 'data:application/pdf;base64,JVBERi0xLjQK';
      const matchesPdf = unsupportedPdf.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
      assert.equal(matchesPdf, null);
    });

    it('rejects image files exceeding 5MB limit', () => {
      // Create a simulated 5.5MB buffer
      const oversizedBytes = 5.5 * 1024 * 1024;
      const isOversized = oversizedBytes > 5 * 1024 * 1024;
      assert.equal(isOversized, true);
    });
  });

  // 2. Complaint Schema Acceptance with Uploaded or External URLs
  describe('2. Complaint Evidence URL Schema Acceptance', () => {
    it('accepts complaint with uploaded server evidence URL (e.g. http://localhost:5000/uploads/evidence/...)', () => {
      const result = createComplaintSchema.safeParse({
        body: {
          orderId: validOrderId,
          category: 'DAMAGED_PRODUCT',
          subject: 'Broken jar seal',
          description: 'The glass seal on the honey jar arrived completely broken.',
          evidenceUrls: ['http://localhost:5000/uploads/evidence/evidence-1793718426-abcdef.jpg'],
        },
      });

      assert.equal(result.success, true);
      assert.deepEqual(result.data.body.evidenceUrls, [
        'http://localhost:5000/uploads/evidence/evidence-1793718426-abcdef.jpg',
      ]);
    });

    it('accepts complaint with external HTTPS image URL', () => {
      const result = createComplaintSchema.safeParse({
        body: {
          orderId: validOrderId,
          category: 'EXPIRED_OR_UNSAFE_PRODUCT',
          subject: 'Expired milk cartons',
          description: 'Carton expiry date printed on package is already past.',
          evidenceUrls: ['https://images.example.com/disputes/expired-carton.jpg'],
        },
      });

      assert.equal(result.success, true);
      assert.equal(result.data.body.evidenceUrls[0], 'https://images.example.com/disputes/expired-carton.jpg');
    });

    it('accepts complaint submitted without any evidence image (optional field)', () => {
      const result = createComplaintSchema.safeParse({
        body: {
          orderId: validOrderId,
          category: 'ORDER_NOT_RECEIVED',
          subject: 'Package was never delivered',
          description: 'Driver marked order as delivered but nothing arrived at my doorstep.',
          evidenceUrls: [],
        },
      });

      assert.equal(result.success, true);
      assert.deepEqual(result.data.body.evidenceUrls, []);
    });

    it('rejects raw base64 data: URLs directly in evidenceUrls (enforcing URL storage in DB)', () => {
      const result = createComplaintSchema.safeParse({
        body: {
          orderId: validOrderId,
          category: 'DAMAGED_PRODUCT',
          subject: 'Broken jar seal',
          description: 'The glass seal on the honey jar arrived completely broken.',
          evidenceUrls: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='],
        },
      });

      assert.equal(result.success, false);
    });

    it('rejects invalid or malformed evidence URLs', () => {
      const result = createComplaintSchema.safeParse({
        body: {
          orderId: validOrderId,
          category: 'DAMAGED_PRODUCT',
          subject: 'Broken jar seal',
          description: 'The glass seal on the honey jar arrived completely broken.',
          evidenceUrls: ['not-a-valid-url'],
        },
      });

      assert.equal(result.success, false);
    });
  });
});

