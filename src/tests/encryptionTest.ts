// Comprehensive test suite for token encryption security
import { TokenEncryption, EncryptionMetrics } from '../services/tokenEncryption';
import { TokenManager } from '../services/tokenManager';
import { KeyRotationService } from '../services/keyRotation';
import { AuthSecurity } from '../utils/authSecurity';

export interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: Record<string, any>;
}

export interface TestSuite {
  name: string;
  results: TestResult[];
  overallPassed: boolean;
  totalDuration: number;
  successRate: number;
}

export class EncryptionTestSuite {
  /**
   * Run comprehensive encryption security tests
   */
  static async runAllTests(): Promise<TestSuite[]> {
    console.log('🧪 Starting comprehensive encryption security tests...');
    
    const testSuites: TestSuite[] = [
      await this.runBasicEncryptionTests(),
      await this.runSecurityTests(),
      await this.runPerformanceTests(),
      await this.runTokenManagerTests(),
      await this.runKeyRotationTests(),
      await this.runEdgeCaseTests()
    ];
    
    // Generate overall test report
    const totalTests = testSuites.reduce((sum, suite) => sum + suite.results.length, 0);
    const passedTests = testSuites.reduce((sum, suite) => 
      sum + suite.results.filter(r => r.passed).length, 0);
    const overallSuccess = (passedTests / totalTests) * 100;
    
    console.log(`\n🎯 Overall Test Results: ${passedTests}/${totalTests} tests passed (${overallSuccess.toFixed(1)}%)`);
    
    return testSuites;
  }

  /**
   * Basic encryption functionality tests
   */
  private static async runBasicEncryptionTests(): Promise<TestSuite> {
    const testSuite: TestSuite = {
      name: 'Basic Encryption',
      results: [],
      overallPassed: true,
      totalDuration: 0,
      successRate: 0
    };

    // Test 1: Web Crypto API availability
    testSuite.results.push(await this.runTest('Web Crypto API Available', async () => {
      const isSupported = TokenEncryption.isWebCryptoSupported();
      if (!isSupported) {
        throw new Error('Web Crypto API not supported in this environment');
      }
      return { supported: isSupported };
    }));

    // Test 2: Basic encryption/decryption
    testSuite.results.push(await this.runTest('Basic Encrypt/Decrypt', async () => {
      const testData = 'test-access-token-12345';
      const encrypted = await TokenEncryption.encryptToken(testData, 'test-user');
      const decrypted = await TokenEncryption.decryptToken(encrypted, 'test-user');
      
      if (decrypted !== testData) {
        throw new Error(`Decryption failed: expected "${testData}", got "${decrypted}"`);
      }
      
      return { 
        originalLength: testData.length,
        encryptedLength: encrypted.encryptedData.length,
        algorithm: encrypted.algorithm,
        keyVersion: encrypted.keyVersion
      };
    }));

    // Test 3: Different user contexts
    testSuite.results.push(await this.runTest('User Context Isolation', async () => {
      const testData = 'user-specific-token';
      const user1Encrypted = await TokenEncryption.encryptToken(testData, 'user1');
      const user2Encrypted = await TokenEncryption.encryptToken(testData, 'user2');
      
      // Same data should produce different encrypted results for different users
      if (user1Encrypted.encryptedData === user2Encrypted.encryptedData) {
        throw new Error('User context isolation failed - same encrypted data for different users');
      }
      
      // Each user should be able to decrypt their own data
      const user1Decrypted = await TokenEncryption.decryptToken(user1Encrypted, 'user1');
      const user2Decrypted = await TokenEncryption.decryptToken(user2Encrypted, 'user2');
      
      if (user1Decrypted !== testData || user2Decrypted !== testData) {
        throw new Error('User-specific decryption failed');
      }
      
      return {
        user1Hash: user1Encrypted.encryptedData.substring(0, 16),
        user2Hash: user2Encrypted.encryptedData.substring(0, 16),
        isolated: user1Encrypted.encryptedData !== user2Encrypted.encryptedData
      };
    }));

    // Test 4: Large data encryption
    testSuite.results.push(await this.runTest('Large Data Encryption', async () => {
      const largeData = 'x'.repeat(10000); // 10KB of data
      const encrypted = await TokenEncryption.encryptToken(largeData, 'test-user');
      const decrypted = await TokenEncryption.decryptToken(encrypted, 'test-user');
      
      if (decrypted !== largeData) {
        throw new Error('Large data encryption/decryption failed');
      }
      
      return {
        originalSize: largeData.length,
        encryptedSize: encrypted.encryptedData.length,
        compressionRatio: encrypted.encryptedData.length / largeData.length
      };
    }));

    this.finalizeTestSuite(testSuite);
    return testSuite;
  }

  /**
   * Security-focused tests
   */
  private static async runSecurityTests(): Promise<TestSuite> {
    const testSuite: TestSuite = {
      name: 'Security Validation',
      results: [],
      overallPassed: true,
      totalDuration: 0,
      successRate: 0
    };

    // Test 1: Cross-user decryption should fail
    testSuite.results.push(await this.runTest('Cross-User Access Prevention', async () => {
      const testData = 'sensitive-token-data';
      const user1Encrypted = await TokenEncryption.encryptToken(testData, 'user1');
      
      try {
        // Try to decrypt with wrong user context
        await TokenEncryption.decryptToken(user1Encrypted, 'user2');
        throw new Error('Cross-user decryption should have failed but succeeded');
      } catch (error) {
        if (error instanceof Error && error.message.includes('should have failed')) {
          throw error;
        }
        // Expected failure - this is good
        return { accessDenied: true };
      }
    }));

    // Test 2: Invalid encrypted data should fail
    testSuite.results.push(await this.runTest('Invalid Data Rejection', async () => {
      const invalidData = {
        encryptedData: 'invalid-base64-data',
        iv: 'invalid-iv',
        salt: 'invalid-salt',
        keyVersion: 1,
        algorithm: 'AES-GCM',
        iterations: 100000
      };
      
      try {
        await TokenEncryption.decryptToken(invalidData, 'test-user');
        throw new Error('Invalid data decryption should have failed but succeeded');
      } catch (error) {
        if (error instanceof Error && error.message.includes('should have failed')) {
          throw error;
        }
        return { rejected: true };
      }
    }));

    // Test 3: Encryption randomness
    testSuite.results.push(await this.runTest('Encryption Randomness', async () => {
      const testData = 'identical-input-data';
      const encrypt1 = await TokenEncryption.encryptToken(testData, 'test-user');
      const encrypt2 = await TokenEncryption.encryptToken(testData, 'test-user');
      
      // Same input should produce different encrypted output due to random IV and salt
      if (encrypt1.encryptedData === encrypt2.encryptedData) {
        throw new Error('Encryption is not sufficiently random - same output for same input');
      }
      
      if (encrypt1.iv === encrypt2.iv) {
        throw new Error('IV is not random - same IV used twice');
      }
      
      if (encrypt1.salt === encrypt2.salt) {
        throw new Error('Salt is not random - same salt used twice');
      }
      
      return {
        uniqueEncrypted: encrypt1.encryptedData !== encrypt2.encryptedData,
        uniqueIV: encrypt1.iv !== encrypt2.iv,
        uniqueSalt: encrypt1.salt !== encrypt2.salt
      };
    }));

    // Test 4: Security parameter validation
    testSuite.results.push(await this.runTest('Security Parameters', async () => {
      const testData = 'test-token';
      const encrypted = await TokenEncryption.encryptToken(testData, 'test-user');
      
      // Validate security parameters
      const validAlgorithm = encrypted.algorithm === 'AES-GCM';
      const validIterations = encrypted.iterations >= 100000;
      const validKeyVersion = encrypted.keyVersion >= 1;
      
      if (!validAlgorithm || !validIterations || !validKeyVersion) {
        throw new Error('Security parameters below minimum requirements');
      }
      
      return {
        algorithm: encrypted.algorithm,
        iterations: encrypted.iterations,
        keyVersion: encrypted.keyVersion,
        ivLength: encrypted.iv.length,
        saltLength: encrypted.salt.length
      };
    }));

    this.finalizeTestSuite(testSuite);
    return testSuite;
  }

  /**
   * Performance and efficiency tests
   */
  private static async runPerformanceTests(): Promise<TestSuite> {
    const testSuite: TestSuite = {
      name: 'Performance',
      results: [],
      overallPassed: true,
      totalDuration: 0,
      successRate: 0
    };

    // Test 1: Encryption performance benchmarks
    testSuite.results.push(await this.runTest('Encryption Performance', async () => {
      const metrics = await TokenEncryption.getEncryptionMetrics();
      
      if (!metrics.success) {
        throw new Error(`Performance test failed: ${metrics.error}`);
      }
      
      // Performance thresholds (reasonable for modern devices)
      const maxEncryptionTime = 1000; // 1 second
      const maxDecryptionTime = 500;  // 0.5 seconds
      
      if (metrics.encryptionTime > maxEncryptionTime) {
        throw new Error(`Encryption too slow: ${metrics.encryptionTime.toFixed(2)}ms (max: ${maxEncryptionTime}ms)`);
      }
      
      if (metrics.decryptionTime > maxDecryptionTime) {
        throw new Error(`Decryption too slow: ${metrics.decryptionTime.toFixed(2)}ms (max: ${maxDecryptionTime}ms)`);
      }
      
      return {
        encryptionTime: metrics.encryptionTime,
        decryptionTime: metrics.decryptionTime,
        withinThresholds: true
      };
    }));

    // Test 2: Concurrent encryption operations
    testSuite.results.push(await this.runTest('Concurrent Operations', async () => {
      const testData = 'concurrent-test-token';
      const numOperations = 5;
      
      const startTime = performance.now();
      
      // Run multiple encryption operations concurrently
      const promises = Array(numOperations).fill(0).map((_, i) => 
        TokenEncryption.encryptToken(`${testData}-${i}`, 'test-user')
      );
      
      const results = await Promise.all(promises);
      const totalTime = performance.now() - startTime;
      
      // Verify all operations succeeded and produced different results
      const uniqueResults = new Set(results.map(r => r.encryptedData));
      if (uniqueResults.size !== numOperations) {
        throw new Error('Concurrent operations produced non-unique results');
      }
      
      return {
        operations: numOperations,
        totalTime: totalTime,
        averageTime: totalTime / numOperations,
        uniqueResults: uniqueResults.size
      };
    }));

    this.finalizeTestSuite(testSuite);
    return testSuite;
  }

  /**
   * TokenManager integration tests
   */
  private static async runTokenManagerTests(): Promise<TestSuite> {
    const testSuite: TestSuite = {
      name: 'TokenManager Integration',
      results: [],
      overallPassed: true,
      totalDuration: 0,
      successRate: 0
    };

    // Test 1: Full token storage and retrieval cycle
    testSuite.results.push(await this.runTest('Full Storage Cycle', async () => {
      const tokenManager = new (TokenManager as any)(); // Access private constructor
      
      const testTokens = {
        accessToken: 'test-access-token-12345',
        refreshToken: 'test-refresh-token-67890',
        expiresAt: Date.now() + 3600000,
        tokenType: 'bearer'
      };
      
      // Store tokens
      await tokenManager.storeTokens(testTokens);
      
      // Retrieve tokens
      const retrievedTokens = await tokenManager.getStoredTokens();
      
      if (!retrievedTokens) {
        throw new Error('Failed to retrieve stored tokens');
      }
      
      if (retrievedTokens.accessToken !== testTokens.accessToken ||
          retrievedTokens.refreshToken !== testTokens.refreshToken) {
        throw new Error('Retrieved tokens do not match stored tokens');
      }
      
      // Clean up
      await tokenManager.clearStoredTokens();
      
      return {
        stored: true,
        retrieved: true,
        matched: true
      };
    }));

    this.finalizeTestSuite(testSuite);
    return testSuite;
  }

  /**
   * Key rotation functionality tests
   */
  private static async runKeyRotationTests(): Promise<TestSuite> {
    const testSuite: TestSuite = {
      name: 'Key Rotation',
      results: [],
      overallPassed: true,
      totalDuration: 0,
      successRate: 0
    };

    // Test 1: Rotation status check
    testSuite.results.push(await this.runTest('Rotation Status Check', async () => {
      const status = KeyRotationService.checkRotationStatus();
      
      return {
        hasStatus: !!status,
        currentVersion: status.currentVersion,
        targetVersion: status.targetVersion,
        rotationRequired: status.rotationRequired,
        reason: status.reason
      };
    }));

    // Test 2: Legacy migration simulation
    testSuite.results.push(await this.runTest('Legacy Migration', async () => {
      // Simulate legacy token storage
      localStorage.setItem('dropbox_access_token', 'legacy-access-token');
      localStorage.setItem('dropbox_refresh_token', 'legacy-refresh-token');
      
      const result = await KeyRotationService.migrateLegacyTokens();
      
      return {
        migrationSuccess: result.success,
        tokensUpdated: result.tokensUpdated,
        errors: result.errors,
        duration: result.duration
      };
    }));

    this.finalizeTestSuite(testSuite);
    return testSuite;
  }

  /**
   * Edge case and error handling tests
   */
  private static async runEdgeCaseTests(): Promise<TestSuite> {
    const testSuite: TestSuite = {
      name: 'Edge Cases',
      results: [],
      overallPassed: true,
      totalDuration: 0,
      successRate: 0
    };

    // Test 1: Empty data encryption
    testSuite.results.push(await this.runTest('Empty Data Handling', async () => {
      const emptyData = '';
      const encrypted = await TokenEncryption.encryptToken(emptyData, 'test-user');
      const decrypted = await TokenEncryption.decryptToken(encrypted, 'test-user');
      
      if (decrypted !== emptyData) {
        throw new Error('Empty data encryption/decryption failed');
      }
      
      return { handlesEmpty: true };
    }));

    // Test 2: Special characters
    testSuite.results.push(await this.runTest('Special Characters', async () => {
      const specialData = '!@#$%^&*()_+-=[]{}|;\':",./<>?`~äöü漢字🚀';
      const encrypted = await TokenEncryption.encryptToken(specialData, 'test-user');
      const decrypted = await TokenEncryption.decryptToken(encrypted, 'test-user');
      
      if (decrypted !== specialData) {
        throw new Error('Special character encryption/decryption failed');
      }
      
      return { handlesSpecialChars: true };
    }));

    this.finalizeTestSuite(testSuite);
    return testSuite;
  }

  /**
   * Run a single test with error handling and timing
   */
  private static async runTest(testName: string, testFn: () => Promise<any>): Promise<TestResult> {
    const startTime = performance.now();
    
    try {
      console.log(`  🧪 Running: ${testName}`);
      const details = await testFn();
      const duration = performance.now() - startTime;
      
      console.log(`  ✅ ${testName} (${duration.toFixed(2)}ms)`);
      
      return {
        testName,
        passed: true,
        duration,
        details
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.log(`  ❌ ${testName}: ${errorMessage} (${duration.toFixed(2)}ms)`);
      
      return {
        testName,
        passed: false,
        duration,
        error: errorMessage
      };
    }
  }

  /**
   * Finalize test suite with statistics
   */
  private static finalizeTestSuite(testSuite: TestSuite): void {
    const passedTests = testSuite.results.filter(r => r.passed).length;
    const totalTests = testSuite.results.length;
    
    testSuite.overallPassed = passedTests === totalTests;
    testSuite.successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
    testSuite.totalDuration = testSuite.results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log(`\n📊 ${testSuite.name}: ${passedTests}/${totalTests} tests passed (${testSuite.successRate.toFixed(1)}%) in ${testSuite.totalDuration.toFixed(2)}ms\n`);
  }

  /**
   * Generate test report for console output
   */
  static generateTestReport(testSuites: TestSuite[]): string {
    let report = '\n🔒 ENCRYPTION SECURITY TEST REPORT\n';
    report += '='.repeat(50) + '\n\n';
    
    testSuites.forEach(suite => {
      report += `📋 ${suite.name}\n`;
      report += `-`.repeat(30) + '\n';
      report += `Success Rate: ${suite.successRate.toFixed(1)}%\n`;
      report += `Duration: ${suite.totalDuration.toFixed(2)}ms\n`;
      report += `Status: ${suite.overallPassed ? '✅ PASSED' : '❌ FAILED'}\n\n`;
      
      suite.results.forEach(result => {
        const icon = result.passed ? '✅' : '❌';
        report += `  ${icon} ${result.testName} (${result.duration.toFixed(2)}ms)\n`;
        if (!result.passed && result.error) {
          report += `      Error: ${result.error}\n`;
        }
      });
      
      report += '\n';
    });
    
    return report;
  }
}

export default EncryptionTestSuite;