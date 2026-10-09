import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createComplaintSchema,
  customerReplySchema,
  adminMessageSchema,
} from '../src/validators/complaint.validator.js';

describe('SEC-22-F01: Focused Complaint URL Validator Suite', () => {
  const validOrderId = '507f1f77bcf86cd799439011';
  const validComplaintId = '507f1f77bcf86cd799439022';

  describe('1. createComplaintSchema evidenceUrls validation', () => {
    it('accepts valid HTTPS evidence URLs', () => {
      const result = createComplaintSchema.safeParse({
        body: {
          orderId: validOrderId,
          category: 'DAMAGED_PRODUCT',
          subject: 'Broken bottle neck',
          description: 'Package arrived damaged and contents leaked out.',
          evidenceUrls: ['https://storage.example.com/photos/damage1.png'],
        },
      });
      assert.equal(result.success, true);
      assert.deepEqual(result.data.body.evidenceUrls, [
        'https://storage.example.com/photos/damage1.png',
      ]);
    });

    it('accepts valid HTTP evidence URLs', () => {
      const result = createComplaintSchema.safeParse({
        body: {
          orderId: validOrderId,
          category: 'DAMAGED_PRODUCT',
          subject: 'Broken bottle neck',
          description: 'Package arrived damaged and contents leaked out.',
          evidenceUrls: ['http://cdn.example.com/photos/damage1.jpg'],
        },
      });
      assert.equal(result.success, true);
    });

    it('accepts empty or omitted evidenceUrls array', () => {
      const result1 = createComplaintSchema.safeParse({
        body: {
          orderId: validOrderId,
          category: 'DAMAGED_PRODUCT',
          subject: 'Broken bottle neck',
          description: 'Package arrived damaged and contents leaked out.',
          evidenceUrls: [],
        },
      });
      assert.equal(result1.success, true);

      const result2 = createComplaintSchema.safeParse({
        body: {
          orderId: validOrderId,
          category: 'DAMAGED_PRODUCT',
          subject: 'Broken bottle neck',
          description: 'Package arrived damaged and contents leaked out.',
        },
      });
      assert.equal(result2.success, true);
      assert.deepEqual(result2.data.body.evidenceUrls, []);
    });

    it('rejects javascript: evidence URLs', () => {
      const result = createComplaintSchema.safeParse({
        body: {
          orderId: validOrderId,
          category: 'DAMAGED_PRODUCT',
          subject: 'Broken bottle neck',
          description: 'Package arrived damaged and contents leaked out.',
          evidenceUrls: ['javascript:alert(document.cookie)'],
        },
      });
      assert.equal(result.success, false);
      const issue = result.error.issues.find((i) => i.path.includes('evidenceUrls'));
      assert.ok(issue, 'Should flag invalid evidenceUrls issue');
      assert.match(issue.message, /http or https/i);
    });

    it('rejects data: evidence URLs', () => {
      const result = createComplaintSchema.safeParse({
        body: {
          orderId: validOrderId,
          category: 'DAMAGED_PRODUCT',
          subject: 'Broken bottle neck',
          description: 'Package arrived damaged and contents leaked out.',
          evidenceUrls: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE='],
        },
      });
      assert.equal(result.success, false);
      const issue = result.error.issues.find((i) => i.path.includes('evidenceUrls'));
      assert.ok(issue);
      assert.match(issue.message, /http or https/i);
    });

    it('rejects file: evidence URLs', () => {
      const result = createComplaintSchema.safeParse({
        body: {
          orderId: validOrderId,
          category: 'DAMAGED_PRODUCT',
          subject: 'Broken bottle neck',
          description: 'Package arrived damaged and contents leaked out.',
          evidenceUrls: ['file:///etc/passwd'],
        },
      });
      assert.equal(result.success, false);
      const issue = result.error.issues.find((i) => i.path.includes('evidenceUrls'));
      assert.ok(issue);
      assert.match(issue.message, /http or https/i);
    });

    it('rejects array containing mixed valid and malicious URLs', () => {
      const result = createComplaintSchema.safeParse({
        body: {
          orderId: validOrderId,
          category: 'DAMAGED_PRODUCT',
          subject: 'Broken bottle neck',
          description: 'Package arrived damaged and contents leaked out.',
          evidenceUrls: [
            'https://storage.example.com/photos/valid.png',
            'javascript:alert("XSS")',
          ],
        },
      });
      assert.equal(result.success, false);
      assert.equal(result.error.issues[0].path[2], 1); // Points to index 1
    });

    it('rejects malformed non-URL strings', () => {
      const result = createComplaintSchema.safeParse({
        body: {
          orderId: validOrderId,
          category: 'DAMAGED_PRODUCT',
          subject: 'Broken bottle neck',
          description: 'Package arrived damaged and contents leaked out.',
          evidenceUrls: ['not-a-url-at-all'],
        },
      });
      assert.equal(result.success, false);
    });

    it('preserves maximum 10 evidence items limit', () => {
      const elevenUrls = Array.from({ length: 11 }, (_, i) => `https://example.com/img${i}.jpg`);
      const result = createComplaintSchema.safeParse({
        body: {
          orderId: validOrderId,
          category: 'DAMAGED_PRODUCT',
          subject: 'Broken bottle neck',
          description: 'Package arrived damaged and contents leaked out.',
          evidenceUrls: elevenUrls,
        },
      });
      assert.equal(result.success, false);
      assert.match(result.error.issues[0].message, /Maximum 10/i);
    });
  });

  describe('2. customerReplySchema attachments validation', () => {
    it('accepts valid HTTPS attachment URLs', () => {
      const result = customerReplySchema.safeParse({
        params: { complaintId: validComplaintId },
        body: {
          message: 'Here is the replacement proof photo',
          attachments: ['https://cdn.example.com/proof.jpg'],
        },
      });
      assert.equal(result.success, true);
    });

    it('rejects javascript: and data: attachments in customer reply', () => {
      const jsResult = customerReplySchema.safeParse({
        params: { complaintId: validComplaintId },
        body: {
          message: 'Exploit attempt',
          attachments: ['javascript:void(0)'],
        },
      });
      assert.equal(jsResult.success, false);

      const dataResult = customerReplySchema.safeParse({
        params: { complaintId: validComplaintId },
        body: {
          message: 'Data URI attempt',
          attachments: ['data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='],
        },
      });
      assert.equal(dataResult.success, false);
    });
  });

  describe('3. adminMessageSchema attachments validation', () => {
    it('accepts valid HTTPS attachments in admin message', () => {
      const result = adminMessageSchema.safeParse({
        params: { complaintId: validComplaintId },
        body: {
          message: 'Resolution dossier document attached for review.',
          attachments: ['https://admin.nearexpiry.internal/reports/dossier.pdf'],
          isInternalNote: false,
        },
      });
      assert.equal(result.success, true);
    });

    it('rejects file: and javascript: attachments in admin message', () => {
      const fileResult = adminMessageSchema.safeParse({
        params: { complaintId: validComplaintId },
        body: {
          message: 'Attempting local file disclosure',
          attachments: ['file:///C:/Windows/win.ini'],
          isInternalNote: true,
        },
      });
      assert.equal(fileResult.success, false);

      const jsResult = adminMessageSchema.safeParse({
        params: { complaintId: validComplaintId },
        body: {
          message: 'XSS in message',
          attachments: ['javascript:alert(1)'],
          isInternalNote: false,
        },
      });
      assert.equal(jsResult.success, false);
    });
  });
});

