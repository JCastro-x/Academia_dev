# Bandwidth Optimizations Applied
**Date**: April 27, 2026
**Purpose**: Reduce Supabase egress bandwidth usage to stay within 5.5 GB limit

## Problem
- Current usage: 13.24 GB of 5.5 GB (240% over limit)
- Deadline: April 30, 2026 (3 days)
- Risk: Services will be restricted with 402 errors

## Changes Implemented

### 1. Reduced Sync Frequency (`js/init.js`)
- **Before**: Sync every 1 hour (3600000ms)
- **After**: Sync every 6 hours (21600000ms)
- **Impact**: 83% reduction in periodic sync operations

### 2. Disabled Automatic Sync Triggers (`js/init.js`)
- **Disabled**: Sync on window focus
- **Disabled**: Sync on visibility change (tab switch)
- **Kept**: Sync on page load (initial sync only)
- **Impact**: Eliminates unnecessary syncs from user multitasking

### 3. Increased Save Debounce (`js/academia-sync.js`)
- **Before**: 5000ms debounce before saving to Supabase
- **After**: 10000ms debounce
- **Impact**: Fewer save operations during rapid editing

### 4. Aggressive Pomodoro Data Optimization (`js/academia-sync.js`)
- **Always exclude**: pomodoro snapshots (very large)
- **Always exclude**: pomodoro history (reduced retention)
- **History retention**: Reduced from 7 days to 3 days
- **Impact**: Significant reduction in payload size per sync

### 5. Always Optimize Data Before Upload (`js/academia-sync.js`)
- **Before**: Only optimize if payload > 500KB
- **After**: Always optimize before every upload
- **Impact**: Consistent bandwidth savings on all operations

### 6. Canvas Data Optimization (`js/academia-sync.js`)
- **Before**: Full canvas data in notes
- **After**: Only IDB references for canvas data
- **Impact**: Images stay in IndexedDB, not synced to Supabase

## Expected Bandwidth Savings

### Per User Estimates
- **Initial sync**: ~50-100 KB (down from ~200-500 KB)
- **Periodic sync**: ~20-50 KB every 6 hours (down from ~100-300 KB every hour)
- **Save operations**: ~30-80 KB (down from ~100-400 KB)

### Overall Reduction
- **Sync operations**: ~83% fewer (6 hours vs 1 hour)
- **Payload size**: ~60-75% smaller per operation
- **Total bandwidth**: Estimated 70-85% reduction

## Monitoring Recommendations

### 1. Check Supabase Dashboard
- Monitor egress in Usage Dashboard
- Look for trends over next 3 days
- Compare with previous days

### 2. Console Logs
The app now logs bandwidth usage:
- `📥 DB.load: datos cargados desde Supabase (X KB egress)`
- `☁️ DB.save: datos guardados en Supabase (X KB egress)`
- `📉 Optimización de ancho de banda: X KB → Y KB (ahorrados Z KB)`

### 3. Manual Sync Option
Users can still sync manually by:
- Refreshing the page (triggers initial sync)
- Making changes (triggers debounced save after 10s)

## Additional Recommendations

### Short-term (Before April 30)
1. **Deploy these changes immediately** to production
2. **Monitor usage closely** for 24-48 hours
3. **Consider upgrading to Pro plan** if usage doesn't drop sufficiently

### Long-term
1. **Implement delta sync**: Only sync changed fields, not entire payload
2. **Add compression**: Use gzip compression on payloads
3. **Cache strategy**: Implement more aggressive local caching
4. **Data retention**: Add automatic cleanup of old data

## Rollback Plan
If needed, revert changes by:
1. Restore `js/init.js` sync interval to 3600000ms
2. Restore `js/academia-sync.js` debounce to 5000ms
3. Re-enable focus/visibility sync triggers

## Notes
- IndexedDB is used for large images and canvas data (not synced)
- LocalStorage used for text data (synced to Supabase)
- Pomodoro snapshots are never synced (too large)
- Preflight checks prevent unnecessary downloads when data hasn't changed
