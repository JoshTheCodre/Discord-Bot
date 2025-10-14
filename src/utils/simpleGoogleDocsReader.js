const https = require('https');
const http = require('http');

/**
 * Google Docs Reader (Alternative Method)
 * Attempts to read Google Docs content using export URLs
 */
class SimpleGoogleDocsReader {
  constructor() {
    this.documentUrl = null;
    this.documentId = null;
  }

  /**
   * Extract document ID from Google Docs URL
   */
  extractDocumentId(url) {
    const patterns = [
      /\/document\/d\/([a-zA-Z0-9-_]+)/,
      /\/d\/([a-zA-Z0-9-_]+)/,
      /id=([a-zA-Z0-9-_]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    throw new Error('Could not extract document ID from URL');
  }

  /**
   * Make HTTP request
   */
  makeRequest(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https:') ? https : http;
      
      const request = protocol.get(url, (response) => {
        let data = '';
        
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return this.makeRequest(response.headers.location).then(resolve).catch(reject);
        }
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            data: data
          });
        });
      });
      
      request.on('error', (error) => {
        reject(error);
      });
      
      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * Attempt to read document using various methods
   */
  async readDocument(documentUrl) {
    try {
      console.log('📄 Attempting to read Google Document...');
      console.log('🔗 URL:', documentUrl);

      this.documentUrl = documentUrl;
      this.documentId = this.extractDocumentId(documentUrl);
      console.log('🆔 Document ID:', this.documentId);

      const methods = [
        this.tryPublicExport.bind(this),
        this.tryPlainTextExport.bind(this),
        this.tryHtmlExport.bind(this),
        this.tryPublicView.bind(this)
      ];

      for (const method of methods) {
        try {
          const result = await method();
          if (result.success) {
            return result;
          }
        } catch (error) {
          console.log(`⚠️  Method failed: ${error.message}`);
        }
      }

      throw new Error('All methods failed to read the document');

    } catch (error) {
      console.error('❌ Error reading document:', error.message);
      throw error;
    }
  }

  /**
   * Try reading as public export (plain text)
   */
  async tryPublicExport() {
    console.log('🔄 Trying public plain text export...');
    
    const exportUrl = `https://docs.google.com/document/d/${this.documentId}/export?format=txt`;
    
    const response = await this.makeRequest(exportUrl);
    
    if (response.statusCode === 200 && response.data.length > 0) {
      console.log('✅ Successfully read document as plain text');
      return {
        success: true,
        method: 'public_plain_text_export',
        title: 'Google Document',
        documentId: this.documentId,
        content: response.data,
        contentType: 'text/plain'
      };
    }
    
    throw new Error(`Export failed with status ${response.statusCode}`);
  }

  /**
   * Try reading as HTML export
   */
  async tryHtmlExport() {
    console.log('🔄 Trying HTML export...');
    
    const exportUrl = `https://docs.google.com/document/d/${this.documentId}/export?format=html`;
    
    const response = await this.makeRequest(exportUrl);
    
    if (response.statusCode === 200 && response.data.length > 0) {
      console.log('✅ Successfully read document as HTML');
      
      // Extract text from HTML
      const textContent = this.extractTextFromHtml(response.data);
      
      return {
        success: true,
        method: 'html_export',
        title: this.extractTitleFromHtml(response.data) || 'Google Document',
        documentId: this.documentId,
        content: textContent,
        htmlContent: response.data,
        contentType: 'text/html'
      };
    }
    
    throw new Error(`HTML export failed with status ${response.statusCode}`);
  }

  /**
   * Try reading the public view page
   */
  async tryPublicView() {
    console.log('🔄 Trying public view page...');
    
    const viewUrl = `https://docs.google.com/document/d/${this.documentId}/pub`;
    
    const response = await this.makeRequest(viewUrl);
    
    if (response.statusCode === 200 && response.data.length > 0) {
      console.log('✅ Successfully accessed public view');
      
      const textContent = this.extractTextFromHtml(response.data);
      
      return {
        success: true,
        method: 'public_view',
        title: this.extractTitleFromHtml(response.data) || 'Google Document',
        documentId: this.documentId,
        content: textContent,
        htmlContent: response.data,
        contentType: 'text/html'
      };
    }
    
    throw new Error(`Public view failed with status ${response.statusCode}`);
  }

  /**
   * Try alternative plain text method
   */
  async tryPlainTextExport() {
    console.log('🔄 Trying alternative plain text export...');
    
    const exportUrl = `https://docs.google.com/document/u/0/export?format=txt&id=${this.documentId}`;
    
    const response = await this.makeRequest(exportUrl);
    
    if (response.statusCode === 200 && response.data.length > 0) {
      console.log('✅ Successfully read document via alternative export');
      return {
        success: true,
        method: 'alternative_plain_text_export',
        title: 'Google Document',
        documentId: this.documentId,
        content: response.data,
        contentType: 'text/plain'
      };
    }
    
    throw new Error(`Alternative export failed with status ${response.statusCode}`);
  }

  /**
   * Extract text content from HTML
   */
  extractTextFromHtml(html) {
    // Remove HTML tags and decode entities
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')   // Remove styles
      .replace(/<[^>]*>/g, '')                          // Remove HTML tags
      .replace(/&nbsp;/g, ' ')                          // Decode non-breaking spaces
      .replace(/&amp;/g, '&')                           // Decode ampersands
      .replace(/&lt;/g, '<')                            // Decode less than
      .replace(/&gt;/g, '>')                            // Decode greater than
      .replace(/&quot;/g, '"')                          // Decode quotes
      .replace(/&#39;/g, "'")                           // Decode apostrophes
      .replace(/\s+/g, ' ')                             // Normalize whitespace
      .trim();
    
    return text;
  }

  /**
   * Extract title from HTML
   */
  extractTitleFromHtml(html) {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim();
    }
    return null;
  }
}

module.exports = SimpleGoogleDocsReader;
