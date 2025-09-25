import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SPFFlattener } from '../src/spf-flattener.js';

// Mock fetch for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SPFFlattener', () => {
  let flattener;

  beforeEach(() => {
    flattener = new SPFFlattener();
    mockFetch.mockClear();
  });

  describe('parseSPF', () => {
    it('should parse a valid SPF record', () => {
      const spf = 'v=spf1 ip4:192.168.1.0/24 include:_spf.google.com ~all';
      const result = flattener.parseSPF(spf);
      expect(result).toEqual(['ip4:192.168.1.0/24', 'include:_spf.google.com', '~all']);
    });

    it('should handle SPF record with extra spaces', () => {
      const spf = 'v=spf1  ip4:192.168.1.0/24   include:_spf.google.com  ~all  ';
      const result = flattener.parseSPF(spf);
      expect(result).toEqual(['ip4:192.168.1.0/24', 'include:_spf.google.com', '~all']);
    });

    it('should throw error for invalid SPF record', () => {
      const invalidSpf = 'invalid record';
      expect(() => flattener.parseSPF(invalidSpf)).toThrow('Invalid SPF record format');
    });

    it('should throw error for empty record', () => {
      expect(() => flattener.parseSPF('')).toThrow('Invalid SPF record format');
    });
  });

  describe('resolveTXT', () => {
    it('should resolve SPF record successfully', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          Answer: [
            {
              type: 16,
              data: '"v=spf1 ip4:192.168.1.0/24 ~all"'
            }
          ]
        })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await flattener.resolveTXT('example.com');
      expect(result).toBe('v=spf1 ip4:192.168.1.0/24 ~all');
    });

    it('should return null when no SPF record found', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          Answer: [
            {
              type: 16,
              data: '"some other txt record"'
            }
          ]
        })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await flattener.resolveTXT('example.com');
      expect(result).toBe(null);
      expect(flattener.voidLookupCount).toBe(1);
    });

    it('should handle DNS query failure', async () => {
      mockFetch.mockResolvedValue({ ok: false });

      const result = await flattener.resolveTXT('example.com');
      expect(result).toBe(null);
      expect(flattener.voidLookupCount).toBe(1);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await flattener.resolveTXT('example.com');
      expect(result).toBe(null);
      expect(flattener.voidLookupCount).toBe(1);
    });
  });

  describe('flatten', () => {
    it('should flatten SPF record with includes', async () => {
      // Mock main domain SPF lookup
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            Answer: [
              {
                type: 16,
                data: '"v=spf1 ip4:192.168.1.0/24 include:spf.example.com ~all"'
              }
            ]
          })
        })
        // Mock included domain SPF lookup
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            Answer: [
              {
                type: 16,
                data: '"v=spf1 ip4:10.0.0.0/8 ip6:2001:db8::/32 ~all"'
              }
            ]
          })
        });

      const result = await flattener.flatten('example.com');
      expect(result).toBe('v=spf1 ip4:192.168.1.0/24 ip4:10.0.0.0/8 ip6:2001:db8::/32 ~all');
      expect(flattener.lookupCount).toBe(2);
    });

    it('should flatten direct SPF record input', async () => {
      // Mock included domain SPF lookup
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          Answer: [
            {
              type: 16,
              data: '"v=spf1 ip4:10.0.0.0/8 ip6:2001:db8::/32 ~all"'
            }
          ]
        })
      });

      const directSpf = 'v=spf1 ip4:192.168.1.0/24 include:spf.example.com ~all';
      const result = await flattener.flatten(directSpf, true);
      expect(result).toBe('v=spf1 ip4:192.168.1.0/24 ip4:10.0.0.0/8 ip6:2001:db8::/32 ~all');
      expect(flattener.lookupCount).toBe(1); // No initial domain lookup
    });

    it('should handle domain with no SPF record', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      await expect(flattener.flatten('example.com')).rejects.toThrow('No SPF record found for domain: example.com');
    });

    it('should respect lookup limits', async () => {
      flattener.maxLookups = 1;
      
      // Mock main domain SPF lookup
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          Answer: [
            {
              type: 16,
              data: '"v=spf1 include:spf1.example.com include:spf2.example.com ~all"'
            }
          ]
        })
      });

      await expect(flattener.flatten('example.com')).rejects.toThrow('Too many DNS lookups (RFC 7208 limit exceeded)');
    });
  });
});