# 🔒 Secure Token Encryption Implementation Guide

**Enterprise-grade AES-GCM encryption with PBKDF2 key derivation for Dropbox refresh tokens.**

## 🎯 Overview

This implementation provides military-grade security for storing Dropbox refresh tokens with:

- **AES-GCM Encryption**: 256-bit authenticated encryption
- **PBKDF2 Key Derivation**: 100,000+ iterations with user-specific salts
- **Automatic Key Rotation**: 90-day rotation schedule with seamless migration
- **Zero-Trust Architecture**: Never store tokens in plain text
- **Comprehensive Auditing**: Full security event logging and monitoring

## 🚀 Quick Start

### Automatic Integration

The encryption system is **automatically active** when you use the existing Dropbox authentication:

```javascript
// Normal usage - encryption happens automatically
import { dropboxService } from './services/dropboxService';

// Connect to Dropbox (encryption handled transparently)
await dropboxService.authenticate();

// Tokens are automatically encrypted and stored
// Automatic key rotation and security monitoring active
```

### Manual Security Audit

```javascript
import { AuthSecurity } from './utils/authSecurity';

// Run comprehensive security audit
const audit = await AuthSecurity.auditSecurity();
console.log(`Security Score: ${audit.score}/100`);

// Check recommendations
audit.recommendations.forEach(rec => console.log(rec));
```

### Manual Encryption Operations

```javascript
import { TokenEncryption } from './services/tokenEncryption';

// Encrypt sensitive data
const encrypted = await TokenEncryption.encryptToken(
  'sensitive-token-data', 
  'user-id'
);

// Decrypt when needed
const decrypted = await TokenEncryption.decryptToken(encrypted, 'user-id');
```

## 🔐 Security Features

### Encryption Specifications

- **Algorithm**: AES-GCM (Galois/Counter Mode)
- **Key Size**: 256 bits
- **IV Size**: 96 bits (recommended for GCM)
- **Authentication Tag**: 128 bits
- **Key Derivation**: PBKDF2 with SHA-256
- **Iterations**: 100,000 (OWASP recommended minimum)
- **Salt Size**: 256 bits (cryptographically random)

### User Isolation

```javascript
// Each user gets unique encryption keys
const user1Token = await TokenEncryption.encryptToken(data, 'user1');
const user2Token = await TokenEncryption.encryptToken(data, 'user2');

// Cross-user access is cryptographically impossible
// user1 cannot decrypt user2's tokens
```

### Key Derivation Context

Keys are derived from multiple sources for maximum security:

- **User ID**: Firebase authentication UID
- **Domain Context**: Application hostname
- **Device Fingerprint**: Partial browser fingerprint
- **Application Salt**: App-specific constant

## 🔄 Key Rotation System

### Automatic Rotation

```javascript
import { KeyRotationService } from './services/keyRotation';

// Check rotation status
const status = KeyRotationService.checkRotationStatus();
console.log(`Rotation required: ${status.rotationRequired}`);
console.log(`Reason: ${status.reason}`);

// Force rotation (security incident response)
const result = await KeyRotationService.forceRotation('Security incident');
console.log(`Tokens updated: ${result.tokensUpdated}`);
```

### Rotation Schedule

- **Normal Interval**: 90 days
- **Maximum Age**: 365 days (forced rotation)
- **Automatic Check**: Every hour
- **Zero Downtime**: Seamless token migration

### Legacy Migration

```javascript
// Automatic migration from old token system
const migrationResult = await KeyRotationService.migrateLegacyTokens();

if (migrationResult.success) {
  console.log(`Migrated ${migrationResult.tokensUpdated} tokens`);
} else {
  console.error(`Migration errors:`, migrationResult.errors);
}
```

## 🧪 Security Testing

### Comprehensive Test Suite

```javascript
import { EncryptionTestSuite } from './tests/encryptionTest';

// Run all security tests
const testSuites = await EncryptionTestSuite.runAllTests();

// Generate detailed report
const report = EncryptionTestSuite.generateTestReport(testSuites);
console.log(report);
```

### Test Categories

1. **Basic Encryption**: Functionality and correctness
2. **Security Validation**: Cross-user isolation, randomness
3. **Performance**: Encryption/decryption speed benchmarks
4. **Integration**: TokenManager compatibility
5. **Key Rotation**: Rotation and migration testing
6. **Edge Cases**: Error handling and special data

### Performance Benchmarks

Expected performance on modern devices:
- **Encryption**: < 100ms for typical tokens
- **Decryption**: < 50ms for typical tokens
- **Key Derivation**: < 200ms (cached for session)

## 📊 Security Monitoring

### Audit Logs

All security events are automatically logged:

```javascript
// Access security logs
const tokenLogs = JSON.parse(sessionStorage.getItem('token_security_log') || '[]');
const rotationLogs = JSON.parse(sessionStorage.getItem('key_rotation_log') || '[]');
const auditLogs = JSON.parse(sessionStorage.getItem('security_audit_log') || '[]');

// Example log entry
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "event": "TOKEN_STORAGE_ENCRYPTED",
  "component": "TokenManager",
  "userId": "user123",
  "details": {
    "algorithm": "AES-GCM",
    "keyDerivation": "PBKDF2"
  }
}
```

### Security Events

Monitored events include:
- `TOKEN_STORAGE_ENCRYPTED`: Successful token encryption
- `TOKEN_RETRIEVAL_ENCRYPTED`: Successful token decryption
- `TOKEN_DECRYPTION_FAILED`: Failed decryption attempt
- `KEY_ROTATION_SUCCESS`: Successful key rotation
- `LEGACY_MIGRATION_SUCCESS`: Legacy token migration
- `ENCRYPTION_SUCCESS`: Individual encryption operation
- `SECURITY_VIOLATION`: Potential security breach

## ⚙️ Configuration

### Environment Variables

```bash
# Required: Dropbox App Key
VITE_DROPBOX_APP_KEY=your_app_key

# Optional: Client secret (for development only)
VITE_DROPBOX_APP_SECRET=your_app_secret

# Production: Use server-side encryption
VITE_USE_SERVER_API=true
VITE_API_BASE_URL=https://your-server.com/api
```

### Security Settings

```javascript
// Customize encryption parameters (advanced)
const customEncryption = {
  iterations: 150000,    // Higher security (slower)
  keyVersion: 2,         // Version for rotation
  algorithm: 'AES-GCM'   // Encryption algorithm
};
```

## 🚨 Security Best Practices

### Development

```javascript
// ✅ Good: Use encryption automatically
await dropboxService.authenticate();

// ❌ Bad: Manual token handling
localStorage.setItem('token', 'plain-text-token');
```

### Production Deployment

1. **Enable Server-Side API**: Set `VITE_USE_SERVER_API=true`
2. **Remove Client Secrets**: Never deploy `VITE_DROPBOX_APP_SECRET`
3. **Use HTTPS**: Enforce secure transport layer
4. **Monitor Logs**: Set up security event monitoring
5. **Regular Audits**: Run `AuthSecurity.auditSecurity()` regularly

### Incident Response

```javascript
// Security incident detected
await KeyRotationService.forceRotation('Security incident');
await tokenManager.clearStoredTokens();

// Run security audit
const audit = await AuthSecurity.auditSecurity();
console.log('Post-incident security score:', audit.score);
```

## 📋 API Reference

### TokenEncryption

```javascript
// Static methods
TokenEncryption.isWebCryptoSupported(): boolean
TokenEncryption.encryptToken(data: string, userId?: string): Promise<EncryptedData>
TokenEncryption.decryptToken(encrypted: EncryptedData, userId?: string): Promise<string>
TokenEncryption.getEncryptionMetrics(): Promise<EncryptionMetrics>
TokenEncryption.secureCleanup(): void
```

### KeyRotationService

```javascript
// Key rotation management
KeyRotationService.checkRotationStatus(): KeyRotationStatus
KeyRotationService.performAutoRotation(): Promise<MigrationResult>
KeyRotationService.forceRotation(reason: string): Promise<MigrationResult>
KeyRotationService.migrateLegacyTokens(): Promise<MigrationResult>
KeyRotationService.scheduleRotation(): void
```

### AuthSecurity

```javascript
// Security auditing
AuthSecurity.auditSecurity(): Promise<SecurityAudit>
AuthSecurity.validateRefreshSecurity(): Promise<boolean>
AuthSecurity.startSecurityMonitoring(): void
```

## 🔧 Troubleshooting

### Common Issues

**"Web Crypto API not supported"**
- **Cause**: Browser doesn't support Web Crypto API
- **Solution**: System falls back to base64 encoding with warning

**"Token decryption failed"**
- **Cause**: Wrong user context or corrupted data
- **Solution**: Clear tokens and re-authenticate

**"Key rotation required"**
- **Cause**: Keys older than rotation interval
- **Solution**: Automatic rotation runs on next operation

### Debug Mode

```javascript
// Enable detailed logging
localStorage.setItem('debug_encryption', 'true');

// Check encryption status
const audit = await AuthSecurity.auditSecurity();
audit.checks.forEach(check => {
  console.log(`${check.name}: ${check.passed ? 'PASS' : 'FAIL'}`);
  if (!check.passed) console.log(`  ${check.message}`);
});
```

### Performance Issues

```javascript
// Benchmark encryption performance
const metrics = await TokenEncryption.getEncryptionMetrics();
console.log(`Encryption: ${metrics.encryptionTime.toFixed(2)}ms`);
console.log(`Decryption: ${metrics.decryptionTime.toFixed(2)}ms`);

// If performance is poor, check:
// 1. Device hardware capabilities
// 2. Browser Web Crypto implementation
// 3. Network latency for server-side operations
```

## 🎯 Migration Guide

### From Previous Token System

The migration is automatic, but you can monitor progress:

```javascript
// Check for legacy tokens
const hasLegacy = !!localStorage.getItem('dropbox_access_token');

if (hasLegacy) {
  console.log('Legacy tokens detected, migration will run automatically');
}

// Migration runs automatically on service initialization
// Check migration logs for results
```

### Version Upgrades

Future encryption versions will be handled automatically:

```javascript
// Check current encryption version
const status = KeyRotationService.checkRotationStatus();
console.log(`Current version: ${status.currentVersion}`);
console.log(`Target version: ${status.targetVersion}`);

// Automatic upgrade on next token operation
```

## 📞 Support

For security questions or issues:

1. **Run Security Audit**: `AuthSecurity.auditSecurity()`
2. **Check Console Logs**: Look for encryption-related messages
3. **Verify Environment**: Ensure Web Crypto API support
4. **Test Encryption**: Use `EncryptionTestSuite.runAllTests()`

---

**Security Note**: This implementation follows industry best practices for client-side encryption. For maximum security in production environments, consider server-side token management with the provided API integration.