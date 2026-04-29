/**
 * Metrics module - Monitors transfer usage and sync performance
 * Helps identify data leaks and optimize bandwidth usage
 */

(function() {
  'use strict';

  // Transfer metrics tracking
  const metrics = {
    downloads: 0,
    uploads: 0,
    totalBytes: 0,
    syncCalls: 0,
    avoidedDownloads: 0,
    lastReset: Date.now()
  };

  // Configuration
  const CONFIG = {
    MAX_HISTORY: 100,
    RESET_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
    ALERT_THRESHOLD: 50 * 1024 * 1024, // 50MB daily
    LOG_LEVEL: 'info' // 'debug', 'info', 'warn', 'error'
  };

  // History for detailed analysis
  let history = [];

  // Estimate data size from JSON
  function estimateDataSize(data) {
    if (!data) return 0;
    try {
      const jsonStr = JSON.stringify(data);
      return new Blob([jsonStr]).size;
    } catch {
      return 0;
    }
  }

  // Add metric entry
  function addEntry(type, bytes, details = {}) {
    const entry = {
      timestamp: Date.now(),
      type, // 'download', 'upload', 'sync', 'avoided'
      bytes,
      details
    };

    history.push(entry);
    if (history.length > CONFIG.MAX_HISTORY) {
      history = history.slice(-CONFIG.MAX_HISTORY);
    }

    // Update counters
    switch (type) {
      case 'download':
        metrics.downloads++;
        metrics.totalBytes += bytes;
        break;
      case 'upload':
        metrics.uploads++;
        metrics.totalBytes += bytes;
        break;
      case 'sync':
        metrics.syncCalls++;
        break;
      case 'avoided':
        metrics.avoidedDownloads++;
        break;
    }

    // Check thresholds
    checkThresholds();
    
    // Log if enabled
    if (CONFIG.LOG_LEVEL !== 'error') {
      console.log(`📊 ${type.toUpperCase()}: ${formatBytes(bytes)} - ${details.reason || 'No reason'}`);
    }
  }

  // Check if thresholds are exceeded
  function checkThresholds() {
    const now = Date.now();
    const dayStart = now - CONFIG.RESET_INTERVAL;
    
    // Calculate daily usage
    const dailyEntries = history.filter(e => e.timestamp > dayStart);
    const dailyBytes = dailyEntries.reduce((sum, e) => sum + e.bytes, 0);
    
    if (dailyBytes > CONFIG.ALERT_THRESHOLD) {
      console.warn(`⚠️ Daily transfer threshold exceeded: ${formatBytes(dailyBytes)}`);
      if (typeof window._appNotify === 'function') {
        window._appNotify(`High data usage detected: ${formatBytes(dailyBytes)} today`, 'warning');
      }
    }
  }

  // Format bytes for human reading
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Get metrics summary
  function getSummary() {
    const now = Date.now();
    const dayStart = now - CONFIG.RESET_INTERVAL;
    
    const dailyEntries = history.filter(e => e.timestamp > dayStart);
    const dailyBytes = dailyEntries.reduce((sum, e) => sum + e.bytes, 0);
    
    return {
      current: {
        downloads: metrics.downloads,
        uploads: metrics.uploads,
        syncCalls: metrics.syncCalls,
        avoidedDownloads: metrics.avoidedDownloads,
        totalBytes: metrics.totalBytes
      },
      daily: {
        bytes: dailyBytes,
        downloads: dailyEntries.filter(e => e.type === 'download').length,
        uploads: dailyEntries.filter(e => e.type === 'upload').length,
        syncs: dailyEntries.filter(e => e.type === 'sync').length,
        avoided: dailyEntries.filter(e => e.type === 'avoided').length
      },
      efficiency: metrics.avoidedDownloads > 0 ? 
        Math.round((metrics.avoidedDownloads / (metrics.downloads + metrics.avoidedDownloads)) * 100) : 0
    };
  }

  // Reset metrics
  function reset() {
    Object.assign(metrics, {
      downloads: 0,
      uploads: 0,
      totalBytes: 0,
      syncCalls: 0,
      avoidedDownloads: 0,
      lastReset: Date.now()
    });
    history = [];
    console.log('📊 Metrics reset');
  }

  // Auto-reset daily
  setInterval(() => {
    const now = Date.now();
    if (now - metrics.lastReset > CONFIG.RESET_INTERVAL) {
      reset();
    }
  }, CONFIG.RESET_INTERVAL);

  // Expose API
  window.DataMetrics = {
    trackDownload: (data, reason) => addEntry('download', estimateDataSize(data), { reason }),
    trackUpload: (data, reason) => addEntry('upload', estimateDataSize(data), { reason }),
    trackSync: (reason) => addEntry('sync', 0, { reason }),
    trackAvoided: (reason) => addEntry('avoided', 0, { reason }),
    getSummary,
    reset,
    getHistory: () => [...history],
    setLogLevel: (level) => { CONFIG.LOG_LEVEL = level; }
  };

  })();
