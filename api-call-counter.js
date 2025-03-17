// api-call-counter.js

class ApiCallCounter {
    constructor() {
      this.counters = {
        total: 0,
        breakdown: {}
      };
      this.logs = [];
      this.limits = {};
      this.initializeStorage();
    }
  
    /**
     * Initialize storage for persisting API call counts
     */
    initializeStorage() {
      const fs = require('fs');
      const path = require('path');
      const { app } = require('electron');
      
      this.storagePath = path.join(app.getPath('userData'), 'api-call-counts.json');
      
      try {
        if (fs.existsSync(this.storagePath)) {
          const data = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
          this.counters = data.counters || this.counters;
          this.logs = data.logs || this.logs;
          this.limits = data.limits || this.limits;
        }
      } catch (error) {
        console.error('Failed to load API call counts:', error);
      }
    }
  
    /**
     * Save current state to storage
     */
    saveToStorage() {
      const fs = require('fs');
      try {
        fs.writeFileSync(this.storagePath, JSON.stringify({
          counters: this.counters,
          logs: this.logs,
          limits: this.limits
        }), 'utf8');
      } catch (error) {
        console.error('Failed to save API call counts:', error);
      }
    }
  
    /**
     * Record an API call
     * @param {string} endpoint - The Google Maps API endpoint called
     * @param {Object} options - Additional options
     * @param {number} options.cost - The cost in API quota units (default: 1)
     * @param {string} options.details - Additional details about the call
     */
    recordCall(endpoint, options = { cost: 1, details: '' }) {
      const timestamp = new Date();
      
      // Increment total counter
      this.counters.total += options.cost;
      
      // Initialize endpoint counter if it doesn't exist
      if (!this.counters.breakdown[endpoint]) {
        this.counters.breakdown[endpoint] = 0;
      }
      
      // Increment endpoint counter
      this.counters.breakdown[endpoint] += options.cost;
      
      // Add to logs
      this.logs.push({
        timestamp,
        endpoint,
        cost: options.cost,
        details: options.details
      });
      
      // Trim logs if they get too long
      if (this.logs.length > 1000) {
        this.logs = this.logs.slice(-1000);
      }
      
      // Check for limit warnings
      this.checkLimits(endpoint);
      
      // Save to storage
      this.saveToStorage();
      
      // Return the updated count
      return {
        total: this.counters.total,
        endpoint: this.counters.breakdown[endpoint]
      };
    }
  
    /**
     * Set a limit for an API endpoint
     * @param {string} endpoint - The API endpoint to set a limit for
     * @param {number} limit - The maximum number of calls allowed
     * @param {string} period - The time period for the limit (daily, monthly)
     */
    setLimit(endpoint, limit, period = 'daily') {
      this.limits[endpoint] = {
        limit,
        period,
        lastReset: new Date()
      };
      
      this.saveToStorage();
    }
  
    /**
     * Check if any limits are being approached
     * @param {string} endpoint - The endpoint to check
     */
    checkLimits(endpoint) {
      const { ipcMain } = require('electron');
      
      if (this.limits[endpoint]) {
        const { limit } = this.limits[endpoint];
        const currentCount = this.counters.breakdown[endpoint];
        
        // Alert at 80% and 95% usage
        if (currentCount >= limit * 0.95) {
          ipcMain.emit('api-limit-critical', { endpoint, usage: currentCount, limit });
        } else if (currentCount >= limit * 0.8) {
          ipcMain.emit('api-limit-warning', { endpoint, usage: currentCount, limit });
        }
      }
    }
  
    /**
     * Reset counters based on time periods
     */
    resetPeriodCounters() {
      const now = new Date();
      
      Object.keys(this.limits).forEach(endpoint => {
        const { period, lastReset } = this.limits[endpoint];
        const resetDate = new Date(lastReset);
        
        if (period === 'daily' && now.getDate() !== resetDate.getDate()) {
          this.counters.breakdown[endpoint] = 0;
          this.limits[endpoint].lastReset = now;
        } else if (period === 'monthly' && now.getMonth() !== resetDate.getMonth()) {
          this.counters.breakdown[endpoint] = 0;
          this.limits[endpoint].lastReset = now;
        }
      });
      
      this.saveToStorage();
    }
  
    /**
     * Get the current counters
     * @returns {Object} The current counters
     */
    getCounts() {
      return this.counters;
    }
  
    /**
     * Get the logs for a specific time period
     * @param {Date} startDate - The start date
     * @param {Date} endDate - The end date
     * @returns {Array} The logs for the specified period
     */
    getLogs(startDate = new Date(0), endDate = new Date()) {
      return this.logs.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= startDate && logDate <= endDate;
      });
    }
  
    /**
     * Generate a usage report
     * @param {Date} startDate - The start date for the report
     * @param {Date} endDate - The end date for the report
     * @returns {Object} A usage report
     */
    generateReport(startDate = new Date(0), endDate = new Date()) {
      const filteredLogs = this.getLogs(startDate, endDate);
      
      const report = {
        period: {
          start: startDate,
          end: endDate
        },
        total: 0,
        breakdown: {},
        dailyUsage: {},
        peakUsage: {
          date: null,
          count: 0
        }
      };
      
      filteredLogs.forEach(log => {
        const logDate = new Date(log.timestamp);
        const dateKey = logDate.toISOString().split('T')[0];
        
        // Calculate total
        report.total += log.cost;
        
        // Calculate breakdown by endpoint
        if (!report.breakdown[log.endpoint]) {
          report.breakdown[log.endpoint] = 0;
        }
        report.breakdown[log.endpoint] += log.cost;
        
        // Calculate daily usage
        if (!report.dailyUsage[dateKey]) {
          report.dailyUsage[dateKey] = 0;
        }
        report.dailyUsage[dateKey] += log.cost;
        
        // Track peak usage
        if (report.dailyUsage[dateKey] > report.peakUsage.count) {
          report.peakUsage.date = dateKey;
          report.peakUsage.count = report.dailyUsage[dateKey];
        }
      });
      
      return report;
    }
  }
  
  module.exports = new ApiCallCounter();