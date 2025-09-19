/**
 * SPF Record Parser and Flattener
 * Handles parsing SPF records and resolving include directives
 */

class SPFFlattener {
  constructor() {
    this.maxLookups = 10; // RFC 7208 limit
    this.maxVoidLookups = 2; // RFC 7208 limit
    this.lookupCount = 0;
    this.voidLookupCount = 0;
  }

  /**
   * Parse SPF record into components
   * @param {string} spfRecord - The SPF record string
   * @returns {Array} Array of SPF mechanisms and modifiers
   */
  parseSPF(spfRecord) {
    if (!spfRecord || !spfRecord.startsWith('v=spf1')) {
      throw new Error('Invalid SPF record format');
    }

    // Remove version and split by spaces
    const parts = spfRecord.substring(6).trim().split(/\s+/).filter(part => part.length > 0);
    return parts;
  }

  /**
   * Resolve DNS TXT record
   * @param {string} domain - Domain to lookup
   * @returns {Promise<string|null>} SPF record or null if not found
   */
  async resolveTXT(domain) {
    try {
      const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=TXT`, {
        headers: {
          'Accept': 'application/dns-json'
        }
      });

      if (!response.ok) {
        this.voidLookupCount++;
        return null;
      }

      const data = await response.json();
      
      if (!data.Answer) {
        this.voidLookupCount++;
        return null;
      }

      // Find SPF record among TXT records
      for (const answer of data.Answer) {
        if (answer.type === 16 && answer.data) { // TXT record
          const txtData = answer.data.replace(/"/g, '');
          if (txtData.startsWith('v=spf1')) {
            return txtData;
          }
        }
      }

      this.voidLookupCount++;
      return null;
    } catch (error) {
      this.voidLookupCount++;
      return null;
    }
  }

  /**
   * Flatten SPF record by resolving all includes
   * @param {string} domain - Domain to flatten SPF for
   * @returns {Promise<string>} Flattened SPF record
   */
  async flatten(domain) {
    this.lookupCount = 0;
    this.voidLookupCount = 0;

    const spfRecord = await this.resolveTXT(domain);
    if (!spfRecord) {
      throw new Error(`No SPF record found for domain: ${domain}`);
    }

    this.lookupCount++;

    const mechanisms = this.parseSPF(spfRecord);
    const flattenedMechanisms = [];

    for (const mechanism of mechanisms) {
      if (mechanism.startsWith('include:')) {
        if (this.lookupCount >= this.maxLookups) {
          throw new Error('Too many DNS lookups (RFC 7208 limit exceeded)');
        }
        if (this.voidLookupCount >= this.maxVoidLookups) {
          throw new Error('Too many void lookups (RFC 7208 limit exceeded)');
        }

        const includeDomain = mechanism.substring(8);
        try {
          const includedSPF = await this.resolveTXT(includeDomain);
          this.lookupCount++;

          if (includedSPF) {
            const includedMechanisms = this.parseSPF(includedSPF);
            // Recursively flatten included records (simplified - doesn't handle nested includes)
            for (const includedMech of includedMechanisms) {
              if (!includedMech.startsWith('include:') && 
                  !includedMech.startsWith('redirect=') &&
                  includedMech !== 'all' &&
                  includedMech !== '-all' &&
                  includedMech !== '~all' &&
                  includedMech !== '?all') {
                flattenedMechanisms.push(includedMech);
              }
            }
          }
        } catch (error) {
          // Skip failed includes but continue processing
          console.error(`Failed to resolve include ${includeDomain}:`, error.message);
        }
      } else {
        // Keep non-include mechanisms
        flattenedMechanisms.push(mechanism);
      }
    }

    // Construct flattened SPF record
    return `v=spf1 ${flattenedMechanisms.join(' ')}`;
  }
}

export { SPFFlattener };