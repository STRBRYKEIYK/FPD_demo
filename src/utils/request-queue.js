// ============================================================================
// utils/request-queue.js - Request Queue Manager
// ============================================================================

/**
 * Request Queue Manager
 * Limits concurrent requests to prevent server overload
 */
class RequestQueue {
  constructor(maxConcurrent = 5, delayBetweenBatches = 100) {
    this.maxConcurrent = maxConcurrent;
    this.delayBetweenBatches = delayBetweenBatches;
    this.queue = [];
    this.activeRequests = 0;
    this.processing = false;
  }

  /**
   * Add a request to the queue
   * @param {Function} requestFn - Function that returns a Promise
   * @returns {Promise} Result of the request
   */
  async add(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        requestFn,
        resolve,
        reject,
      });

      if (!this.processing) {
        this.process();
      }
    });
  }

  /**
   * Process the queue
   */
  async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      // Log queue status occasionally
      if (this.queue.length > 5) {
        console.log(`[RequestQueue] Processing queue: ${this.activeRequests} active, ${this.queue.length} waiting`)
      }
      
      // Process batch
      const batch = this.queue.splice(0, this.maxConcurrent - this.activeRequests);
      
      if (batch.length === 0) {
        // Wait for active requests to complete
        await new Promise(resolve => setTimeout(resolve, 50));
        continue;
      }

      const promises = batch.map(async ({ requestFn, resolve, reject }) => {
        this.activeRequests++;
        
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeRequests--;
        }
      });

      await Promise.allSettled(promises);

      // Small delay between batches to prevent server overload
      if (this.queue.length > 0 && this.delayBetweenBatches > 0) {
        await new Promise(resolve => setTimeout(resolve, this.delayBetweenBatches));
      }
    }

    this.processing = false;
  }

  /**
   * Clear the queue
   */
  clear() {
    this.queue = [];
    this.activeRequests = 0;
    this.processing = false;
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      processing: this.processing,
    };
  }
}

// Create singleton instances for different types of requests
export const profileRequestQueue = new RequestQueue(3, 150); // Max 3 concurrent profile requests, 150ms delay
export const apiRequestQueue = new RequestQueue(5, 100); // Max 5 concurrent API requests, 100ms delay
export const descriptorRequestQueue = new RequestQueue(2, 200); // Max 2 concurrent descriptor requests, 200ms delay
export const imageRequestQueue = new RequestQueue(4, 200); // Max 4 concurrent image requests, 200ms delay

export default RequestQueue;