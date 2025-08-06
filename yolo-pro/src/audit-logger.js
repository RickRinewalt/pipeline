class AuditLogger {
  static logs = [];
  
  static logSecurityEvent(event) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'security',
      level: 'warning',
      ...event
    };
    
    this.logs.push(logEntry);
    
    // In production, this would send to a security monitoring system
    console.warn(`[SECURITY] ${event.type}: ${event.payload || event.message}`);
    
    return logEntry;
  }
  
  static logAccess(event) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'access',
      level: 'info',
      ...event
    };
    
    this.logs.push(logEntry);
    return logEntry;
  }
  
  static getSecurityLogs() {
    return this.logs.filter(log => log.type === 'security');
  }
  
  static clearLogs() {
    this.logs = [];
  }
}

module.exports = AuditLogger;